from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.payroll import (
    Employee, PayrollPeriod, PayrollRecord, PayrollNovedad, LiquidacionLaboral,
    SMMLV, AUXILIO_TRANSPORTE,
    PCT_SALUD_EMP, PCT_PENSION_EMP, PCT_SALUD_EMPR, PCT_PENSION_EMPR,
    PCT_ARL, PCT_CAJA, PCT_SENA, PCT_ICBF,
    FACTOR_HED, FACTOR_HEN, FACTOR_HDDF, FACTOR_HNDF, FACTOR_RNOCTURNO,
    PCT_PRIMA, PCT_CESANTIAS, PCT_INT_CESANTIAS, PCT_VACACIONES
)
from extensions import db
from datetime import date, timedelta
import math

# Factores ARL por clase de riesgo
ARL_FACTOR = {1: 0.00522, 2: 0.01044, 3: 0.02436, 4: 0.04350, 5: 0.06960}

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico', 'contador')


def _calcular_record(emp, period, novedades):
    sal = float(emp.salario_base)
    
    # Días reales del período (quincena ~15, mensual ~30)
    dias = min((period.fecha_fin - period.fecha_inicio).days + 1, 30)
    # Novedades que afectan días
    dias_ausencia = 0
    dias_vacaciones = 0
    bonificaciones = 0
    comisiones = 0
    prestamos = 0
    embargos = 0
    adelantos = 0

    for n in novedades:
        if n.tipo in ('incapacidad_general','incapacidad_laboral','ausencia_injustificada','licencia_no_remunerada'):
            dias_ausencia += (n.dias_afectados or 0)
        elif n.tipo == 'vacaciones':
            dias_vacaciones += (n.dias_afectados or 0)
        elif n.tipo == 'bonificacion':
            bonificaciones += float(n.valor)
        elif n.tipo == 'comision':
            comisiones += float(n.valor)
        elif n.tipo == 'prestamo':
            prestamos += float(n.valor)
        elif n.tipo == 'embargo':
            embargos += float(n.valor)
        elif n.tipo == 'adelanto':
            adelantos += float(n.valor)

    dias_trabajados = max(0, dias - dias_ausencia - dias_vacaciones)

    # Salario proporcional
    sal_prop = round(sal * dias_trabajados / 30, 0)

    # Auxilio de transporte (solo si salario <= 2 SMMLV y trabajó días)
    aux_transporte = 0
    if emp.tiene_auxilio_transporte and sal <= (SMMLV * 2) and dias_trabajados > 0:
        aux_transporte = round(AUXILIO_TRANSPORTE * dias_trabajados / 30, 0)

    # Horas extras y recargos (desde novedades u otros registros - se toman del record si ya existen)
    # Aquí se calculan los valores por hora
    valor_hora = sal / 240  # 30 días x 8 horas

    # Total devengado
    total_devengado = (sal_prop + aux_transporte + bonificaciones + comisiones)

    # Deducciones empleado (sobre salario base, no sobre auxilio)
    base_ss = sal_prop  # base seguridad social
    ded_salud    = round(base_ss * PCT_SALUD_EMP, 0)
    ded_pension  = round(base_ss * PCT_PENSION_EMP, 0)
    otros_desc   = prestamos + embargos
    total_ded    = ded_salud + ded_pension + otros_desc + adelantos

    neto = total_devengado - total_ded

    # Aportes empleador
    arl_pct = ARL_FACTOR.get(emp.clase_riesgo_arl or 1, PCT_ARL)
    ap_salud  = round(base_ss * PCT_SALUD_EMPR, 0)
    ap_pension= round(base_ss * PCT_PENSION_EMPR, 0)
    ap_arl    = round(base_ss * arl_pct, 0)
    ap_caja   = round(base_ss * PCT_CAJA, 0)
    ap_sena   = round(base_ss * PCT_SENA, 0) if sal > (SMMLV * 10) else 0
    ap_icbf   = round(base_ss * PCT_ICBF, 0) if sal > (SMMLV * 10) else 0

    # Prestaciones sociales (proporcional al mes)
    base_prest = sal_prop + aux_transporte  # cesantías incluye auxilio
    prima      = round(base_prest * PCT_PRIMA, 0)
    cesantias  = round(base_prest * PCT_CESANTIAS, 0)
    int_ces    = round(cesantias * PCT_INT_CESANTIAS / 12, 0)
    vacaciones = round(sal_prop * PCT_VACACIONES, 0)

    costo_empleador = (total_devengado + ap_salud + ap_pension + ap_arl +
                       ap_caja + ap_sena + ap_icbf + prima + cesantias + int_ces + vacaciones)

    return {
        'dias_trabajados':             dias_trabajados,
        'salario_base_proporcional':   sal_prop,
        'auxilio_transporte':          aux_transporte,
        'bonificaciones':              bonificaciones,
        'comisiones':                  comisiones,
        'deduccion_salud':             ded_salud,
        'deduccion_pension':           ded_pension,
        'otros_descuentos':            otros_desc,
        'adelanto_salario':            adelantos,
        'aporte_salud_empleador':      ap_salud,
        'aporte_pension_empleador':    ap_pension,
        'aporte_arl':                  ap_arl,
        'aporte_caja':                 ap_caja,
        'aporte_sena':                 ap_sena,
        'aporte_icbf':                 ap_icbf,
        'prima_servicios':             prima,
        'cesantias':                   cesantias,
        'intereses_cesantias':         int_ces,
        'vacaciones':                  vacaciones,
        'total_devengado':             total_devengado,
        'total_deducciones':           total_ded,
        'costo_total_empleador':       costo_empleador,
        'neto_a_pagar':                neto,
    }


# ── EMPLEADOS ─────────────────────────────────────────────────────────────
@jwt_required()
def get_employees():
    emps = Employee.query.all()
    return jsonify([e.to_dict() for e in emps]), 200

@jwt_required()
def create_employee():
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    emp = Employee(
        user_id                    = data['user_id'],
        cedula                     = data['cedula'],
        fecha_nacimiento           = data.get('fecha_nacimiento') or None,
        direccion                  = data.get('direccion'),
        telefono                   = data.get('telefono'),
        contacto_emergencia        = data.get('contacto_emergencia'),
        nombre_contacto_emergencia = data.get('nombre_contacto_emergencia'),
        fecha_inicio_contrato      = data['fecha_inicio_contrato'],
        tipo_contrato              = data.get('tipo_contrato', 'indefinido'),
        cargo_oficial              = data.get('cargo_oficial'),
        salario_base               = float(data['salario_base']),
        tiene_auxilio_transporte   = data.get('tiene_auxilio_transporte', True),
        cuenta_bancaria            = data.get('cuenta_bancaria'),
        banco                      = data.get('banco'),
        eps                        = data.get('eps'),
        fondo_pensiones            = data.get('fondo_pensiones'),
        arl                        = data.get('arl'),
        caja_compensacion          = data.get('caja_compensacion'),
        clase_riesgo_arl           = int(data.get('clase_riesgo_arl', 1)),
    )
    db.session.add(emp)
    db.session.commit()
    return jsonify(emp.to_dict()), 201

@jwt_required()
def update_employee(id):
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    emp  = Employee.query.get_or_404(id)
    data = request.get_json()
    for f in ['cedula','fecha_nacimiento','direccion','telefono','contacto_emergencia',
              'nombre_contacto_emergencia','fecha_inicio_contrato','tipo_contrato',
              'cargo_oficial','cuenta_bancaria','banco','eps','fondo_pensiones',
              'arl','caja_compensacion','clase_riesgo_arl','estado','fecha_retiro','motivo_retiro']:
        if f in data:
            setattr(emp, f, data[f] or None)
    if 'salario_base' in data:
        emp.salario_base = float(data['salario_base'])
    if 'tiene_auxilio_transporte' in data:
        emp.tiene_auxilio_transporte = bool(data['tiene_auxilio_transporte'])
    db.session.commit()
    return jsonify(emp.to_dict()), 200


# ── PERÍODOS ──────────────────────────────────────────────────────────────
@jwt_required()
def get_periods():
    periods = PayrollPeriod.query.order_by(PayrollPeriod.period.desc()).all()
    return jsonify([p.to_dict() for p in periods]), 200

@jwt_required()
def create_period():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()
    nombre       = data.get('nombre')
    fecha_inicio = data.get('fecha_inicio')
    fecha_fin    = data.get('fecha_fin')

    if not all([nombre, fecha_inicio, fecha_fin]):
        return jsonify({'message': 'Faltan campos: nombre, fecha_inicio, fecha_fin'}), 400

    try:
        fi = date.fromisoformat(fecha_inicio)
        ff = date.fromisoformat(fecha_fin)
    except ValueError:
        return jsonify({'message': 'Formato de fecha inválido, usar YYYY-MM-DD'}), 400

    # Generar código único ≤ 7 chars
    # Mensual  → "2026-04"
    # 1ª quincena → "2604-Q1"
    # 2ª quincena → "2604-Q2"
    if fi.day == 1 and ff.day <= 15:
        period_code = f"{fi.strftime('%y%m')}-Q1"   # "2604-Q1"
    elif fi.day >= 16:
        period_code = f"{fi.strftime('%y%m')}-Q2"   # "2604-Q2"
    else:
        period_code = fi.strftime('%Y-%m')           # "2026-04"

    if PayrollPeriod.query.filter_by(period=period_code).first():
        return jsonify({'message': f'El período {nombre} ya existe'}), 400

    p = PayrollPeriod(
        period       = period_code,
        fecha_inicio = fi,
        fecha_fin    = ff,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201

# ── CÁLCULO AUTOMÁTICO ────────────────────────────────────────────────────
@jwt_required()
def calculate_period(period_id):
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    period = PayrollPeriod.query.get_or_404(period_id)

    # Eliminar records anteriores
    PayrollRecord.query.filter_by(period_id=period_id).delete()

    employees = Employee.query.filter(Employee.estado != 'retirado').all()
    records = []

    for emp in employees:
        novedades = PayrollNovedad.query.filter_by(
            period_id=period_id, employee_id=emp.id).all()

        calc = _calcular_record(emp, period, novedades)
        r = PayrollRecord(period_id=period_id, employee_id=emp.id, **calc)
        db.session.add(r)
        records.append(r)

    period.status = 'calculado'
    db.session.commit()
    return jsonify({
        'message': f'Nómina calculada para {len(records)} empleado(s)',
        'period':  period.to_dict(),
        'records': [r.to_dict() for r in records],
    }), 200


# ── RECORDS / DESPRENDIBLES ───────────────────────────────────────────────
@jwt_required()
def get_records(period_id):
    records = PayrollRecord.query.filter_by(period_id=period_id).all()
    return jsonify([r.to_dict() for r in records]), 200

@jwt_required()
def get_my_records():
    """Empleado consulta sus propios desprendibles."""
    user_id = int(get_jwt_identity())
    emp = Employee.query.filter_by(user_id=user_id).first()
    if not emp:
        return jsonify({'message': 'No tienes registro de empleado'}), 404
    records = PayrollRecord.query.filter_by(employee_id=emp.id).order_by(
        PayrollRecord.period_id.desc()).all()
    return jsonify([r.to_dict() for r in records]), 200

@jwt_required()
def mark_paid(record_id):
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    r = PayrollRecord.query.get_or_404(record_id)
    r.status         = 'pagado'
    r.metodo_pago    = data.get('metodo_pago')
    r.referencia_pago= data.get('referencia_pago')
    r.fecha_pago     = date.today()
    db.session.commit()
    return jsonify(r.to_dict()), 200


# ── NOVEDADES ─────────────────────────────────────────────────────────────
@jwt_required()
def get_novedades(period_id):
    novs = PayrollNovedad.query.filter_by(period_id=period_id).all()
    return jsonify([n.to_dict() for n in novs]), 200

@jwt_required()
def create_novedad():
    claims  = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    user_id = int(get_jwt_identity())
    data    = request.get_json()
    n = PayrollNovedad(
        period_id      = data['period_id'],
        employee_id    = data['employee_id'],
        tipo           = data['tipo'],
        dias_afectados = data.get('dias_afectados'),
        valor          = float(data.get('valor', 0)),
        descripcion    = data.get('descripcion'),
        registrado_por = user_id,
    )
    db.session.add(n)
    db.session.commit()
    return jsonify(n.to_dict()), 201

@jwt_required()
def delete_novedad(id):
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    n = PayrollNovedad.query.get_or_404(id)
    db.session.delete(n)
    db.session.commit()
    return jsonify({'message': 'Novedad eliminada'}), 200


# ── LIQUIDACIÓN LABORAL ───────────────────────────────────────────────────
@jwt_required()
def calcular_liquidacion(employee_id):
    claims  = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    emp = Employee.query.get_or_404(employee_id)

    hoy   = date.today()
    sal   = float(emp.salario_base)
    inicio= emp.fecha_inicio_contrato
    dias_total = (hoy - inicio).days

    # Meses fraccionados para prestaciones
    meses = emp.meses_trabajados or 1

    cesantias     = round(sal * meses * PCT_CESANTIAS, 0)
    int_ces       = round(cesantias * PCT_INT_CESANTIAS, 0)
    prima         = round(sal * meses * PCT_PRIMA, 0)
    vacaciones    = round(sal * meses * PCT_VACACIONES, 0)

    # Indemnización (contrato indefinido: ≤1 año = 30 días, >1 año = 20 días adicionales por año)
    indemnizacion = 0
    data_req = request.get_json(silent=True) or {}
    motivo = data_req.get('motivo_retiro', 'Renuncia voluntaria')
    if emp.tipo_contrato == 'indefinido' and motivo == 'Despido sin justa causa':
        anos = meses / 12
        if anos <= 1:
            indemnizacion = sal
        else:
            indemnizacion = sal + round(sal * 0.667 * (anos - 1), 0)

    total = cesantias + int_ces + prima + vacaciones + indemnizacion

    return jsonify({
        'employee': emp.to_dict(),
        'dias_trabajados_total': dias_total,
        'ultimo_salario': sal,
        'cesantias_pendientes': cesantias,
        'intereses_cesantias': int_ces,
        'prima_pendiente': prima,
        'vacaciones_pendientes': vacaciones,
        'indemnizacion': indemnizacion,
        'total_liquidacion': total,
        'motivo_retiro': motivo,
    }), 200

@jwt_required()
def guardar_liquidacion():
    claims  = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    user_id = int(get_jwt_identity())
    data    = request.get_json()
    liq = LiquidacionLaboral(
        employee_id           = data['employee_id'],
        fecha_liquidacion     = date.today(),
        motivo_retiro         = data.get('motivo_retiro'),
        dias_trabajados_total = data.get('dias_trabajados_total', 0),
        ultimo_salario        = float(data.get('ultimo_salario', 0)),
        cesantias_pendientes  = float(data.get('cesantias_pendientes', 0)),
        intereses_cesantias   = float(data.get('intereses_cesantias', 0)),
        prima_pendiente       = float(data.get('prima_pendiente', 0)),
        vacaciones_pendientes = float(data.get('vacaciones_pendientes', 0)),
        indemnizacion         = float(data.get('indemnizacion', 0)),
        otros_conceptos       = float(data.get('otros_conceptos', 0)),
        total_liquidacion     = float(data.get('total_liquidacion', 0)),
        created_by            = user_id,
    )
    # Marcar empleado como retirado
    emp = Employee.query.get(data['employee_id'])
    if emp:
        emp.estado        = 'retirado'
        emp.fecha_retiro  = date.today()
        emp.motivo_retiro = data.get('motivo_retiro')
    db.session.add(liq)
    db.session.commit()
    return jsonify(liq.to_dict()), 201

@jwt_required()
def get_liquidaciones():
    liqs = LiquidacionLaboral.query.order_by(LiquidacionLaboral.created_at.desc()).all()
    return jsonify([l.to_dict() for l in liqs]), 200