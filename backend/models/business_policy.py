from extensions import db

class BusinessPolicy(db.Model):
    __tablename__ = 'business_policies'

    id                     = db.Column(db.Integer, primary_key=True)
    # Devoluciones
    return_mode            = db.Column(db.Enum('dinero', 'cambio', 'ambos'), default='ambos')
    return_reason_required = db.Column(db.Boolean, default=True)
    return_max_days        = db.Column(db.Integer, default=30)
    # PIN en devoluciones
    return_pin_monto       = db.Column(db.Integer, default=30000)  # PIN si devolucion en dinero supera este monto
    return_pin_multiple    = db.Column(db.Boolean, default=True)   # PIN si se devuelven varios productos
    # Stock
    low_stock_threshold    = db.Column(db.Integer, default=5)
    expiry_alert_days      = db.Column(db.Integer, default=30)
    # Info negocio
    business_name          = db.Column(db.String(200), default='SmartMerca')
    business_nit           = db.Column(db.String(30), default='')
    business_phone         = db.Column(db.String(30), default='')
    business_address       = db.Column(db.Text, default='')
    updated_at             = db.Column(db.DateTime, onupdate=db.func.now())
    created_at             = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'id':                     self.id,
            'return_mode':            self.return_mode,
            'return_reason_required': self.return_reason_required,
            'return_max_days':        self.return_max_days,
            'return_pin_monto':        self.return_pin_monto,
            'return_pin_multiple':     self.return_pin_multiple,
            'low_stock_threshold':    self.low_stock_threshold,
            'expiry_alert_days':      self.expiry_alert_days,
            'business_name':          self.business_name,
            'business_nit':           self.business_nit,
            'business_phone':         self.business_phone,
            'business_address':       self.business_address,
        }