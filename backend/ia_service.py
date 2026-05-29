"""
Microservicio IA para SmartMerca
Detecta frutas y verduras con YOLOv8
Puerto: 5001
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import base64, numpy as np, cv2, os

app = Flask(__name__)
CORS(app)

# ── Ruta del modelo entrenado ──────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__),
    'ia_models', 'smartmerca-frutas-2', 'weights', 'best.pt')

# ── Rangos de peso válidos por producto (gramos) ──────────────────────────
PESOS_VALIDOS = {
    'tomate':   (50,  400),
    'manzana':  (80,  450),
    'cebolla-': (80,  600),
    'cebolla':  (80,  600),
    'naranja':  (100, 500),
    'banano':   (60,  400),
    'papa':     (50,  500),
    'zanahoria':(40,  300),
}

print(f"Cargando modelo: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
print("✅ Modelo IA listo")

def validar_peso(producto, peso_g):
    """Valida si el peso es coherente con el producto detectado."""
    nombre = producto.lower()
    for key, (min_g, max_g) in PESOS_VALIDOS.items():
        if key in nombre:
            if peso_g < min_g:
                return False, f"Muy liviano para {producto} (mín {min_g}g)"
            if peso_g > max_g:
                return False, f"Muy pesado para {producto} (máx {max_g}g)"
            return True, None
    return True, None  # Sin validación si no está en la tabla

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'modelo': MODEL_PATH}), 200

@app.route('/detect', methods=['POST'])
def detect():
    """
    Recibe imagen en base64 y peso opcional
    Retorna: producto detectado, confianza, alerta
    """
    data = request.get_json()
    if not data or 'imagen' not in data:
        return jsonify({'error': 'Se requiere imagen en base64'}), 400

    # Decodificar imagen
    try:
        img_bytes = base64.b64decode(data['imagen'])
        img_arr   = np.frombuffer(img_bytes, np.uint8)
        img       = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Imagen inválida'}), 400
    except Exception as e:
        return jsonify({'error': f'Error decodificando imagen: {str(e)}'}), 400

    peso_g = float(data.get('peso_g', 0))

    # Detectar con YOLOv8
    results  = model(img, conf=0.60, verbose=False)[0]
    boxes    = results.boxes

    if len(boxes) == 0:
        return jsonify({
            'detectado':  False,
            'producto':   None,
            'confianza':  0,
            'alerta':     'No se detectó ningún producto',
            'peso_ok':    False,
        }), 200

    # Verificar si hay múltiples productos distintos
    clases_detectadas = set()
    for box in boxes:
        nombre_clase = model.names[int(box.cls)]
        clases_detectadas.add(nombre_clase)

    if len(clases_detectadas) > 1:
        return jsonify({
            'detectado':  False,
            'producto':   None,
            'confianza':  0,
            'alerta':     f'Varios productos detectados: {", ".join(clases_detectadas)}. Pese uno a la vez.',
            'peso_ok':    False,
        }), 200

    # Tomar el de mayor confianza
    mejor = max(boxes, key=lambda b: float(b.conf))
    producto   = model.names[int(mejor.cls)]
    confianza  = round(float(mejor.conf) * 100, 1)

    # Validar peso si se envió
    alerta    = None
    peso_ok   = True
    if peso_g > 0:
        peso_ok, msg_peso = validar_peso(producto, peso_g)
        if not peso_ok:
            alerta = f"⚠️ Peso inconsistente: {msg_peso}"

    return jsonify({
        'detectado':  True,
        'producto':   producto,
        'confianza':  confianza,
        'alerta':     alerta,
        'peso_ok':    peso_ok,
        'peso_g':     peso_g,
        'multiples':  len(clases_detectadas) > 1,
    }), 200

if __name__ == '__main__':
    print("🚀 Microservicio IA SmartMerca iniciando en puerto 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)