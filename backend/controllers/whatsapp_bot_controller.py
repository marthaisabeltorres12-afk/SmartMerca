"""
WhatsApp Bot para catálogo y domicilios de SmartMerca
Recibe mensajes entrantes de clientes y responde automáticamente

Flujo:
1. Cliente escribe "hola" → bot saluda y muestra menú
2. Cliente escribe "1" o "productos" → bot muestra categorías
3. Cliente escribe nombre producto → bot muestra precio y stock
4. Cliente escribe "pedir" → bot pide datos para domicilio
5. Bot crea el pedido en SmartMerca
6. Admin recibe notificación con el pedido
"""
import os, requests as req
from flask import request, jsonify
from extensions import db
from datetime import datetime

WHATSAPP_TOKEN   = os.environ.get('WHATSAPP_TOKEN', '')
WHATSAPP_PHONE_ID= os.environ.get('WHATSAPP_PHONE_ID', '')
ADMIN_TELEFONO   = os.environ.get('ADMIN_TELEFONO', '')
VERIFY_TOKEN     = os.environ.get('WHATSAPP_VERIFY_TOKEN', 'smartmerca2026')

# Estado de conversación por número de teléfono
# { "573001234567": { "paso": "menu"|"buscando"|"pidiendo_nombre"|"pidiendo_dir"|"confirmando", "carrito": [], "nombre": "", "dir": "" } }
_sesiones = {}


def _enviar(telefono, mensaje):
    """Envía mensaje de WhatsApp al número dado."""
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
        print(f"[WhatsApp Bot] Sin configurar — mensaje no enviado a {telefono}")
        return False
    try:
        res = req.post(
            f'https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_ID}/messages',
            headers={'Authorization': f'Bearer {WHATSAPP_TOKEN}', 'Content-Type': 'application/json'},
            json={
                'messaging_product': 'whatsapp',
                'to': telefono,
                'type': 'text',
                'text': { 'body': mensaje, 'preview_url': False }
            },
            timeout=10
        )
        return res.status_code == 200
    except Exception as e:
        print(f"[WhatsApp Bot] Error: {e}")
        return False


def _notificar_admin(mensaje):
    """Notifica al admin sobre un nuevo pedido."""
    if ADMIN_TELEFONO:
        _enviar(ADMIN_TELEFONO, mensaje)


def _buscar_productos(query):
    """Busca productos en la BD."""
    from models.product import Product
    if not query:
        return Product.query.filter_by(is_active=True).limit(8).all()
    return Product.query.filter(
        Product.is_active == True,
        Product.name.ilike(f'%{query}%')
    ).limit(6).all()


def _crear_pedido_domicilio(sesion, telefono, nombre_cliente):
    """Crea el pedido de domicilio en la BD."""
    from controllers.domicilio_controller import Domicilio, DomicilioItem
    import random, string

    suffix = ''.join(random.choices(string.digits, k=4))
    numero = f'DOM-{datetime.now().strftime("%Y%m%d")}-{suffix}'

    total = sum(i['cantidad'] * i['precio'] for i in sesion['carrito'])

    # Usar el primer admin como cashier_id
    from models.user import User
    admin = User.query.filter(User.role.in_(['admin','admin_tecnico'])).first()
    if not admin:
        return None

    dom = Domicilio(
        numero_pedido      = numero,
        cliente_nombre     = nombre_cliente,
        cliente_telefono   = telefono,
        cliente_direccion  = sesion.get('direccion', 'Sin dirección'),
        metodo_pago        = 'efectivo',
        total              = total,
        valor_domicilio    = 3000,
        notas              = f'Pedido por WhatsApp',
        cashier_id         = admin.id,
    )
    db.session.add(dom)
    db.session.flush()

    for item in sesion['carrito']:
        db.session.add(DomicilioItem(
            domicilio_id = dom.id,
            product_id   = item['id'],
            product_name = item['nombre'],
            quantity     = item['cantidad'],
            price        = item['precio'],
            subtotal     = item['cantidad'] * item['precio'],
        ))
    db.session.commit()
    return dom


def _procesar_mensaje(telefono, texto):
    """Lógica principal del bot."""
    texto = texto.strip().lower()
    fmt = lambda n: f"${int(n):,}".replace(',','.')

    # Obtener o crear sesión
    if telefono not in _sesiones:
        _sesiones[telefono] = {'paso': 'menu', 'carrito': [], 'nombre': '', 'direccion': ''}
    s = _sesiones[telefono]

    # ── SALUDO ─────────────────────────────────────────────────────────────
    if any(w in texto for w in ['hola','buenas','bueno','hi','hello','buenos dias','buenas tardes','buenas noches','inicio','menu','menú']):
        s['paso'] = 'menu'
        s['carrito'] = []
        _enviar(telefono,
            "👋 *¡Bienvenido a SmartMerca!*\n\n"
            "¿En qué le puedo ayudar?\n\n"
            "1️⃣  Ver productos disponibles\n"
            "2️⃣  Buscar un producto\n"
            "3️⃣  Ver mi carrito\n"
            "4️⃣  Hacer un pedido a domicilio\n\n"
            "Responda con el número o escriba el nombre del producto 🛒"
        )
        return

    # ── VER PRODUCTOS ───────────────────────────────────────────────────────
    if texto in ['1', 'ver productos', 'productos', 'catalogo', 'catálogo']:
        prods = _buscar_productos(None)
        if not prods:
            _enviar(telefono, "😕 No hay productos disponibles en este momento.")
            return
        msg = "🛒 *Productos disponibles:*\n\n"
        for p in prods:
            msg += f"• *{p.name}* — {fmt(p.final_price)}\n"
        msg += "\n✍️ Escribe el nombre del producto para agregarlo al carrito"
        _enviar(telefono, msg)
        s['paso'] = 'buscando'
        return

    # ── BUSCAR PRODUCTO ─────────────────────────────────────────────────────
    if texto in ['2', 'buscar']:
        _enviar(telefono, "🔍 Escribe el nombre del producto que busca:")
        s['paso'] = 'buscando'
        return

    # ── VER CARRITO ─────────────────────────────────────────────────────────
    if texto in ['3', 'carrito', 'ver carrito', 'mi carrito']:
        if not s['carrito']:
            _enviar(telefono, "🛒 Su carrito está vacío.\n\nEscriba *1* para ver productos disponibles.")
            return
        msg = "🛒 *Su carrito:*\n\n"
        total = 0
        for item in s['carrito']:
            sub = item['cantidad'] * item['precio']
            total += sub
            msg += f"• {item['nombre']} x{item['cantidad']} = {fmt(sub)}\n"
        msg += f"\n💰 *Total: {fmt(total)}*\n\n"
        msg += "Escriba *4* o *pedir* para hacer el pedido\nEscriba *limpiar* para vaciar el carrito"
        _enviar(telefono, msg)
        return

    # ── LIMPIAR CARRITO ─────────────────────────────────────────────────────
    if texto in ['limpiar', 'vaciar', 'borrar carrito']:
        s['carrito'] = []
        _enviar(telefono, "🗑️ Carrito vaciado.\n\nEscriba *1* para ver productos.")
        return

    # ── INICIAR PEDIDO ──────────────────────────────────────────────────────
    if texto in ['4', 'pedir', 'pedido', 'domicilio', 'hacer pedido']:
        if not s['carrito']:
            _enviar(telefono, "⚠️ Su carrito está vacío.\nEscriba *1* para ver productos primero.")
            return
        s['paso'] = 'pidiendo_nombre'
        _enviar(telefono, "📦 *Datos para su pedido*\n\n¿Cuál es su nombre completo?")
        return

    # ── RECIBIR NOMBRE ──────────────────────────────────────────────────────
    if s['paso'] == 'pidiendo_nombre':
        s['nombre'] = texto.title()
        s['paso'] = 'pidiendo_dir'
        _enviar(telefono, f"✅ Hola *{s['nombre']}*\n\n📍 ¿Cuál es su dirección de entrega?")
        return

    # ── RECIBIR DIRECCIÓN ───────────────────────────────────────────────────
    if s['paso'] == 'pidiendo_dir':
        s['direccion'] = texto.title()
        s['paso'] = 'confirmando'
        total = sum(i['cantidad']*i['precio'] for i in s['carrito'])
        msg = f"📋 *Confirme su pedido:*\n\n"
        msg += f"👤 Nombre: {s['nombre']}\n"
        msg += f"📍 Dirección: {s['direccion']}\n\n"
        msg += "*Productos:*\n"
        for item in s['carrito']:
            msg += f"• {item['nombre']} x{item['cantidad']} = {fmt(item['cantidad']*item['precio'])}\n"
        msg += f"\n💰 *Total: {fmt(total)}*\n🏍️ Domicilio: {fmt(3000)}\n"
        msg += f"💵 *Total a pagar: {fmt(total+3000)}*\n\n"
        msg += "Escriba *confirmar* para hacer el pedido\nEscriba *cancelar* para cancelar"
        _enviar(telefono, msg)
        return

    # ── CONFIRMAR PEDIDO ────────────────────────────────────────────────────
    if s['paso'] == 'confirmando' and texto in ['confirmar', 'si', 'sí', 'ok', 'listo', 'confirmo']:
        try:
            dom = _crear_pedido_domicilio(s, telefono, s['nombre'])
            if dom:
                total = sum(i['cantidad']*i['precio'] for i in s['carrito'])
                _enviar(telefono,
                    f"✅ *¡Pedido confirmado!*\n\n"
                    f"📦 Número: *{dom.numero_pedido}*\n"
                    f"💰 Total: {fmt(total + 3000)}\n"
                    f"📍 Entrega en: {s['direccion']}\n\n"
                    f"Le avisaremos cuando el domiciliario esté en camino 🛵\n"
                    f"¡Gracias por su compra!"
                )
                _notificar_admin(
                    f"🛵 *NUEVO PEDIDO WhatsApp*\n\n"
                    f"📦 {dom.numero_pedido}\n"
                    f"👤 {s['nombre']} · {telefono}\n"
                    f"📍 {s['direccion']}\n\n" +
                    "\n".join(f"• {i['nombre']} x{i['cantidad']} = {fmt(i['cantidad']*i['precio'])}" for i in s['carrito']) +
                    f"\n\n💰 Total: {fmt(total + 3000)}\n"
                    f"📱 Ingrese a SmartMerca para asignar domiciliario"
                )
                _sesiones.pop(telefono, None)
            else:
                _enviar(telefono, "❌ Error creando el pedido. Intente de nuevo.")
        except Exception as e:
            print(f"[Bot] Error creando pedido: {e}")
            _enviar(telefono, "❌ Error procesando su pedido. Por favor llame al negocio.")
        return

    # ── CANCELAR ────────────────────────────────────────────────────────────
    if texto in ['cancelar', 'no', 'salir']:
        _sesiones.pop(telefono, None)
        _enviar(telefono, "❌ Pedido cancelado.\n\nEscriba *hola* para empezar de nuevo.")
        return

    # ── BUSCAR PRODUCTO POR NOMBRE ──────────────────────────────────────────
    if s['paso'] in ['menu', 'buscando'] and len(texto) >= 3:
        prods = _buscar_productos(texto)
        if not prods:
            _enviar(telefono, f"😕 No encontré productos con *{texto}*.\n\nEscriba *1* para ver todos los productos.")
            return
        if len(prods) == 1:
            p = prods[0]
            s['carrito'].append({'id': p.id, 'nombre': p.name, 'cantidad': 1, 'precio': float(p.final_price)})
            fmt2 = lambda n: f"${int(n):,}".replace(',','.')
            _enviar(telefono,
                f"✅ *{p.name}* agregado al carrito\n"
                f"💰 Precio: {fmt2(p.final_price)}\n"
                f"📦 Stock: {p.stock} disponibles\n\n"
                f"Escriba otro producto o *3* para ver su carrito\nEscriba *4* para hacer el pedido"
            )
        else:
            msg = f"🔍 Encontré {len(prods)} productos:\n\n"
            for i, p in enumerate(prods, 1):
                msg += f"{i}. *{p.name}* — {fmt(p.final_price)}\n"
            msg += "\nEscriba el nombre exacto para agregarlo al carrito"
            _enviar(telefono, msg)
        return

    # ── RESPUESTA POR DEFECTO ───────────────────────────────────────────────
    _enviar(telefono,
        "🤔 No entendí su mensaje.\n\n"
        "Escriba *hola* para ver el menú\n"
        "O escriba el nombre del producto que busca 🛒"
    )


# ── WEBHOOK ENDPOINTS ───────────────────────────────────────────────────────
def webhook_verificar():
    """GET — Meta verifica el webhook."""
    mode      = request.args.get('hub.mode')
    token     = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    if mode == 'subscribe' and token == VERIFY_TOKEN:
        return challenge, 200
    return 'Forbidden', 403


def webhook_recibir():
    """POST — Recibe mensajes entrantes de clientes."""
    data = request.get_json() or {}
    try:
        for entry in data.get('entry', []):
            for change in entry.get('changes', []):
                value = change.get('value', {})
                for msg in value.get('messages', []):
                    telefono = msg.get('from', '')
                    if msg.get('type') == 'text':
                        texto = msg['text']['body']
                        _procesar_mensaje(telefono, texto)
    except Exception as e:
        print(f"[WhatsApp Webhook] Error: {e}")
    return jsonify({'status': 'ok'}), 200