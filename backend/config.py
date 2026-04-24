import os
from datetime import timedelta

class Config:
    SECRET_KEY     = os.environ.get('SECRET_KEY', 'smartmerca_secret_key')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        "mysql+pymysql://root:@localhost:3307/smartmerca"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY            = os.environ.get('JWT_SECRET_KEY', 'jwt_smartmerca_key')
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    # ── Correo ────────────────────────────────────────────────────────────────
    # Reemplaza estos dos valores con tu correo Gmail y su contraseña de aplicación
    MAIL_SERVER         = 'smtp.gmail.com'
    MAIL_PORT           = 587
    MAIL_USE_TLS        = True
    MAIL_USERNAME       = os.environ.get('MAIL_USERNAME', 'TU_CORREO@gmail.com')
    MAIL_PASSWORD       = os.environ.get('MAIL_PASSWORD', 'TU_CONTRASEÑA_DE_APP')
    MAIL_DEFAULT_SENDER = ('SmartMerca', os.environ.get('MAIL_USERNAME', 'TU_CORREO@gmail.com'))