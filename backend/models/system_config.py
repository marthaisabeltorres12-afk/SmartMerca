from extensions import db

class SystemConfig(db.Model):
    __tablename__ = 'system_config'

    id            = db.Column(db.Integer, primary_key=True)
    min_stock     = db.Column(db.Integer, default=5)
    session_hours = db.Column(db.Integer, default=8)
    jwt_active    = db.Column(db.Boolean, default=True)
    cors_active   = db.Column(db.Boolean, default=True)
    plan_actual   = db.Column(db.String(50), default='basico')
    plan_vence    = db.Column(db.Date, nullable=True)
    plan_cliente  = db.Column(db.String(200), default='')
    updated_at    = db.Column(db.DateTime, onupdate=db.func.now())

    def to_dict(self):
        return {
            'id':            self.id,
            'min_stock':     self.min_stock,
            'session_hours': self.session_hours,
            'jwt_active':    self.jwt_active,
            'cors_active':   self.cors_active,
            'plan_actual':   self.plan_actual or 'basico',
            'plan_vence':    str(self.plan_vence) if self.plan_vence else '',
            'plan_cliente':  self.plan_cliente or '',
        }