import os
from datetime import timedelta

class Config:
    # ── Base de datos ─────────────────────────────────────────────────────
    # Railway provee DATABASE_URL automáticamente cuando conectas MySQL
    # Formato: mysql+pymysql://user:pass@host:port/dbname
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'mysql+pymysql://root:@localhost/smartmerca'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 280,
        'pool_pre_ping': True,
        'pool_size': 5,
        'max_overflow': 10,
    }

    # ── JWT ───────────────────────────────────────────────────────────────
    JWT_SECRET_KEY            = os.environ.get('JWT_SECRET_KEY') or 'dev-secret-cambiar-en-produccion'
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(hours=12)

    # ── Flask ─────────────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'flask-secret-cambiar-en-produccion'
    DEBUG      = os.environ.get('DEBUG', 'False').lower() == 'true'

    # ── Correo (opcional) ─────────────────────────────────────────────────
    MAIL_SERVER   = os.environ.get('MAIL_SERVER',   'smtp.gmail.com')
    MAIL_PORT     = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS  = os.environ.get('MAIL_USE_TLS',  'true').lower() == 'true'
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@smartmerca.com')