from extensions import db

class BusinessLine(db.Model):
    """
    Líneas de negocio / categorías.
    Las líneas son las mismas categorías del campo 'category' en products.
    """
    __tablename__ = 'business_lines'

    id                        = db.Column(db.Integer, primary_key=True)
    name                      = db.Column(db.String(150), nullable=False, unique=True)
    color                     = db.Column(db.String(20), nullable=True)
    is_active                 = db.Column(db.Boolean, default=True)
    responsible_user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    presupuesto_compras_mensual = db.Column(db.Numeric(12, 2), nullable=True)
    meta_ventas_mensual       = db.Column(db.Numeric(12, 2), nullable=True)
    created_at                = db.Column(db.DateTime, server_default=db.func.now())

    responsable = db.relationship('User', foreign_keys=[responsible_user_id])

    def to_dict(self):
        return {
            'id':                          self.id,
            'name':                        self.name,
            'color':                       self.color,
            'is_active':                   self.is_active,
            'responsible_user_id':         self.responsible_user_id,
            'responsible_name':            self.responsable.name if self.responsable else None,
            'presupuesto_compras_mensual': float(self.presupuesto_compras_mensual) if self.presupuesto_compras_mensual else None,
            'meta_ventas_mensual':         float(self.meta_ventas_mensual) if self.meta_ventas_mensual else None,
        }