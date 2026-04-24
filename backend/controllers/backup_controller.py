import subprocess
import os
from flask import Response, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import datetime

def _is_tecnico(claims):
    return claims.get('role') == 'admin_tecnico'

@jwt_required()
def download_backup():
    claims = get_jwt()
    if not _is_tecnico(claims):
        return jsonify({'message': 'Acceso denegado — solo admin técnico'}), 403

    # Configuración de la BD
    db_host     = 'localhost'
    db_port     = '3307'
    db_user     = 'root'
    db_password = ''
    db_name     = 'smartmerca'

    # Buscar mysqldump en XAMPP
    mysqldump_paths = [
        r'C:\xampp\mysql\bin\mysqldump.exe',
        r'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe',
        'mysqldump',
    ]
    mysqldump = None
    for path in mysqldump_paths:
        if os.path.exists(path) or path == 'mysqldump':
            mysqldump = path
            break

    if not mysqldump:
        return jsonify({'message': 'mysqldump no encontrado'}), 500

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename  = f'smartmerca_backup_{timestamp}.sql'

    cmd = [
        mysqldump,
        f'--host={db_host}',
        f'--port={db_port}',
        f'--user={db_user}',
        '--no-tablespaces',
        '--single-transaction',
        db_name
    ]
    if db_password:
        cmd.insert(4, f'--password={db_password}')

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            return jsonify({'message': f'Error al generar backup: {result.stderr}'}), 500

        sql_content = result.stdout
        return Response(
            sql_content,
            mimetype='application/octet-stream',
            headers={
                'Content-Disposition': f'attachment; filename={filename}',
                'Content-Length': len(sql_content.encode('utf-8'))
            }
        )
    except subprocess.TimeoutExpired:
        return jsonify({'message': 'Timeout al generar backup'}), 500
    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'}), 500