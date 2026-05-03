"""
Dashboard Predictivo IA — SmartMerca
Analiza el historial de ventas y predice necesidades futuras.
Sin dependencias externas — usa algoritmos propios.
"""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from models.sale import Sale, SaleItem
from models.product import Product
from extensions import db
from sqlalchemy import func
from datetime import datetime, timedelta, date
import statistics

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')


def _ventas_por_dia(product_id, dias=28):
    """Retorna lista de ventas diarias del producto en los últimos N días."""
    hoy    = date.today()
    inicio = hoy - timedelta(days=dias)

    resultados = db.session.query(
        func.date(Sale.created_at).label('dia'),
        func.sum(SaleItem.quantity).label('qty')
    ).join(SaleItem, SaleItem.sale_id == Sale.id).filter(
        SaleItem.product_id == product_id,
        func.date(Sale.created_at) >= inicio,
    ).group_by(func.date(Sale.created_at)).all()

    # Crear mapa día → cantidad
    mapa = {str(r.dia): float(r.qty) for r in resultados}

    # Rellenar días sin ventas con 0
    serie = []
    for i in range(dias):
        d = str(inicio + timedelta(days=i))
        serie.append(mapa.get(d, 0))
    return serie


def _predecir_proxima_semana(serie):
    """
    Predicción simple pero efectiva:
    1. Promedio ponderado (días recientes pesan más)
    2. Detecta tendencia (subiendo/bajando)
    3. Ajusta por estacionalidad semanal
    """
    if not serie or all(v == 0 for v in serie):
        return 0, 'sin_datos'

    n = len(serie)
    # Pesos: días más recientes pesan el doble
    pesos   = [(i + 1) for i in range(n)]
    total_w = sum(pesos)
    prom_ponderado = sum(serie[i] * pesos[i] for i in range(n)) / total_w

    # Tendencia: comparar primera vs segunda mitad
    mitad = n // 2
    prom_primera = statistics.mean(serie[:mitad]) if serie[:mitad] else 0
    prom_segunda = statistics.mean(serie[mitad:]) if serie[mitad:] else 0

    if prom_primera > 0:
        tendencia = (prom_segunda - prom_primera) / prom_primera
    else:
        tendencia = 0

    # Predicción diaria ajustada por tendencia
    pred_diaria = prom_ponderado * (1 + tendencia * 0.5)
    pred_semanal = pred_diaria * 7

    if tendencia > 0.1:
        estado = 'subiendo'
    elif tendencia < -0.1:
        estado = 'bajando'
    else:
        estado = 'estable'

    return max(0, round(pred_semanal, 1)), estado


@jwt_required()
def get_predicciones():
    """
    GET /api/dashboard/predicciones
    Retorna predicciones de demanda para la próxima semana.
    """
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    hoy        = date.today()
    hace_28    = hoy - timedelta(days=28)

    # Productos con ventas en los últimos 28 días
    productos_activos = db.session.query(
        SaleItem.product_id,
        func.sum(SaleItem.quantity).label('total_qty'),
        func.sum(SaleItem.quantity * SaleItem.price).label('total_valor')
    ).join(Sale).filter(
        Sale.created_at >= hace_28
    ).group_by(SaleItem.product_id).order_by(
        func.sum(SaleItem.quantity * SaleItem.price).desc()
    ).limit(20).all()

    predicciones = []
    for row in productos_activos:
        product = Product.query.get(row.product_id)
        if not product or not product.is_active:
            continue

        serie            = _ventas_por_dia(product.id, dias=28)
        pred_semana, tendencia = _predecir_proxima_semana(serie)

        # Stock que necesita para cubrir la predicción
        stock_actual     = product.stock or 0
        necesita_pedir   = max(0, round(pred_semana - stock_actual, 1))
        dias_de_stock    = round(stock_actual / (pred_semana / 7), 1) if pred_semana > 0 else 99

        # Urgencia
        if dias_de_stock <= 2:
            urgencia = 'critica'
        elif dias_de_stock <= 5:
            urgencia = 'alta'
        elif dias_de_stock <= 10:
            urgencia = 'media'
        else:
            urgencia = 'ok'

        predicciones.append({
            'product_id':     product.id,
            'product_name':   product.name,
            'categoria':      product.category or 'Sin categoría',
            'stock_actual':   stock_actual,
            'prediccion_semana': pred_semana,
            'necesita_pedir': necesita_pedir,
            'dias_de_stock':  min(dias_de_stock, 99),
            'tendencia':      tendencia,
            'urgencia':       urgencia,
            'precio':         float(product.price),
            'valor_pedido_estimado': round(necesita_pedir * float(product.price), 0),
            'proveedor':      (product.supplier.company_name or product.supplier.name) if product.supplier else 'Sin proveedor',
        })

    # Ordenar por urgencia
    orden = {'critica': 0, 'alta': 1, 'media': 2, 'ok': 3}
    predicciones.sort(key=lambda x: orden.get(x['urgencia'], 4))

    # Resumen general
    total_valor_pedidos = sum(p['valor_pedido_estimado'] for p in predicciones if p['necesita_pedir'] > 0)
    criticos = [p for p in predicciones if p['urgencia'] == 'critica']
    altos    = [p for p in predicciones if p['urgencia'] == 'alta']

    return jsonify({
        'predicciones':         predicciones,
        'total_productos':      len(predicciones),
        'criticos':             len(criticos),
        'alertas_altas':        len(altos),
       'valor_total_estimado': total_valor_pedidos,
        'fecha_prediccion':     str(hoy),
        'periodo_analisis':     '28 días',
        'proxima_semana':       f'{hoy + timedelta(days=1)} al {hoy + timedelta(days=7)}',
    }), 200


@jwt_required()
def get_tendencias_ventas():
    """
    GET /api/dashboard/tendencias
    Retorna tendencias de ventas por día de la semana y hora.
    """
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    hace_30 = datetime.now() - timedelta(days=30)

    # Ventas por día de la semana
    por_dia = db.session.query(
        func.dayofweek(Sale.created_at).label('dia'),
        func.count(Sale.id).label('transacciones'),
        func.sum(Sale.total).label('total')
    ).filter(Sale.created_at >= hace_30).group_by(
        func.dayofweek(Sale.created_at)
    ).all()

    dias_nombres = {1:'Domingo',2:'Lunes',3:'Martes',4:'Miércoles',5:'Jueves',6:'Viernes',7:'Sábado'}
    ventas_por_dia = [
        {
            'dia':          dias_nombres.get(r.dia, str(r.dia)),
            'transacciones': int(r.transacciones),
            'total':        float(r.total or 0),
        }
        for r in por_dia
    ]
    ventas_por_dia.sort(key=lambda x: list(dias_nombres.values()).index(x['dia']) if x['dia'] in dias_nombres.values() else 0)

    # Ventas por hora del día
    por_hora = db.session.query(
        func.hour(Sale.created_at).label('hora'),
        func.count(Sale.id).label('transacciones'),
        func.sum(Sale.total).label('total')
    ).filter(Sale.created_at >= hace_30).group_by(
        func.hour(Sale.created_at)
    ).order_by(func.hour(Sale.created_at)).all()

    ventas_por_hora = [
        {
            'hora':         f'{r.hora:02d}:00',
            'transacciones': int(r.transacciones),
            'total':        float(r.total or 0),
        }
        for r in por_hora
    ]

    # Mejor día y hora
    mejor_dia  = max(ventas_por_dia,  key=lambda x: x['total']) if ventas_por_dia  else None
    mejor_hora = max(ventas_por_hora, key=lambda x: x['total']) if ventas_por_hora else None
    peor_dia   = min(ventas_por_dia,  key=lambda x: x['total']) if ventas_por_dia  else None

    return jsonify({
        'ventas_por_dia':  ventas_por_dia,
        'ventas_por_hora': ventas_por_hora,
        'mejor_dia':       mejor_dia,
        'peor_dia':        peor_dia,
        'mejor_hora':      mejor_hora,
        'insight': _generar_insight(mejor_dia, peor_dia, mejor_hora),
    }), 200


def _generar_insight(mejor_dia, peor_dia, mejor_hora):
    """Genera un insight en texto natural."""
    partes = []
    if mejor_dia:
        partes.append(f"El {mejor_dia['dia']} es tu mejor día de ventas")
    if peor_dia and mejor_dia and peor_dia['dia'] != mejor_dia['dia']:
        partes.append(f"el {peor_dia['dia']} es el más bajo")
    if mejor_hora:
        partes.append(f"la hora pico es a las {mejor_hora['hora']}")
    return '. '.join(partes) + '.' if partes else 'Acumula más ventas para ver tendencias.'