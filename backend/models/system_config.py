from extensions import db

class SystemConfig(db.Model):
    __tablename__ = 'system_config'

    id            = db.Column(db.Integer, primary_key=True)
    min_stock     = db.Column(db.Integer, default=5)       # stock mínimo para alerta
    session_hours = db.Column(db.Integer, default=8)       # duración de sesión en horas
    jwt_active    = db.Column(db.Boolean, default=True)    # JWT activo
    cors_active   = db.Column(db.Boolean, default=True)    # CORS habilitado
    updated_at    = db.Column(db.DateTime, onupdate=db.func.now())

    def to_dict(self):
        return {
            'id':            self.id,
            'min_stock':     self.min_stock,
            'session_hours': self.session_hours,
            'jwt_active':    self.jwt_active,
            'cors_active':   self.cors_active,
        }