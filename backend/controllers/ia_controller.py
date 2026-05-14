"""
Controlador IA — identificación de productos con Ollama + Qwen2.5-VL
Requiere: ollama corriendo localmente con el modelo qwen2.5vl:7b
  - Instalar Ollama: https://ollama.com
  - Descargar modelo: ollama pull qwen2.5vl:7b
  - Iniciar servidor: ollama serve
"""
import requests
from flask import request, jsonify
from flask_jwt_extended import jwt_required

OLLAMA_URL   = "http://localhost:11434/api/generate"
MODELO       = "qwen2.5vl:7b"
TIMEOUT      = 45  # segundos — el modelo puede tardar en la primera consulta


@jwt_required()
def identificar_producto():
    """
    POST /api/ia/identificar
    Body: { imagen: <base64 sin prefijo>, productos: [<nombres>] }
    Responde: { nombre: <string>, encontrado: bool }
    """
    data       = request.get_json() or {}
    imagen_b64 = data.get('imagen', '').strip()
    productos  = data.get('productos', [])

    if not imagen_b64:
        return jsonify({'message': 'Imagen requerida (base64)'}), 400

    # Quitar prefijo data:image/... si viene con él
    if ',' in imagen_b64:
        imagen_b64 = imagen_b64.split(',', 1)[1]

    # Construir prompt con la lista del inventario
    lista_inventario = ''
    if productos:
        nombres = [str(p).strip() for p in productos[:100] if p]
        lista_inventario = (
            "Estos son los productos disponibles en el inventario:\n" +
            '\n'.join(f"- {n}" for n in nombres) +
            "\n\n"
        )

    prompt = (
        f"{lista_inventario}"
        "Mira la imagen y dime SOLO el nombre del producto que ves. "
        "Si coincide con alguno de la lista de inventario, usa ese nombre exacto. "
        "Si no coincide con ninguno, escribe el nombre genérico en español. "
        "Responde ÚNICAMENTE con el nombre del producto, sin explicaciones, "
        "sin puntuación adicional, sin comillas."
    )

    try:
        res = requests.post(
            OLLAMA_URL,
            json={
                "model":  MODELO,
                "prompt": prompt,
                "images": [imagen_b64],
                "stream": False,
                "options": {
                    "temperature": 0.1,   # respuestas consistentes
                    "num_predict": 30,    # nombre corto, no más
                },
            },
            timeout=TIMEOUT,
        )
        res.raise_for_status()
        nombre_raw = res.json().get('response', '').strip()

        # Limpiar la respuesta — solo el nombre
        nombre = nombre_raw.split('\n')[0].strip().strip('"\'').strip()

        # Ver si coincide con algún producto del inventario
        nombre_lower = nombre.lower()
        encontrado   = any(nombre_lower in p.lower() or p.lower() in nombre_lower
                          for p in productos)

        return jsonify({'nombre': nombre, 'encontrado': encontrado}), 200

    except requests.exceptions.ConnectionError:
        return jsonify({
            'message': 'Ollama no está corriendo. '
                       'Ejecuta en la terminal: ollama serve'
        }), 503

    except requests.exceptions.Timeout:
        return jsonify({
            'message': f'Ollama tardó más de {TIMEOUT}s. '
                       'Puede ser la primera carga del modelo. Intenta de nuevo.'
        }), 504

    except Exception as e:
        return jsonify({'message': f'Error IA: {str(e)}'}), 500


def estado_ollama():
    """
    GET /api/ia/estado
    Verifica si Ollama está corriendo y si el modelo está disponible.
    """
    try:
        res = requests.get('http://localhost:11434/api/tags', timeout=5)
        modelos = [m['name'] for m in res.json().get('models', [])]
        tiene_qwen = any('qwen2.5vl' in m for m in modelos)
        return jsonify({
            'ollama': True,
            'modelo_disponible': tiene_qwen,
            'modelos': modelos,
            'instruccion': '' if tiene_qwen else 'ollama pull qwen2.5vl:7b',
        }), 200
    except requests.exceptions.ConnectionError:
        return jsonify({
            'ollama': False,
            'modelo_disponible': False,
            'instruccion': 'ollama serve',
        }), 200
    except Exception as e:
        return jsonify({'ollama': False, 'error': str(e)}), 200