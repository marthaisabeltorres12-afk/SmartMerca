from extensions import db
from datetime import datetime

class InventoryBatch(db.Model):
    __tablename__ = 'inventory_batches'

    id                 = db.Column(db.Integer, primary_key=True)
    product_id         = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    numero_lote        = db.Column(db.String(50), nullable=True)
    cantidad_inicial   = db.Column(db.Numeric(10, 3), nullable=False)
    cantidad_actual    = db.Column(db.Numeric(10, 3), nullable=False)
    fecha_vencimiento  = db.Column(db.Date, nullable=True)
    costo_unitario     = db.Column(db.Numeric(10, 2), nullable=True)
    supplier_id        = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    fecha_entrada      = db.Column(db.DateTime, default=datetime.now)
    status             = db.Column(db.Enum('activo', 'agotado', 'retirado'), default='activo')
    created_at         = db.Column(db.DateTime, default=datetime.now)

    product  = db.relationship('Product', backref='batches')
    supplier = db.relationship('Supplier', foreign_keys=[supplier_id])

    def to_dict(self):
        return {
            'id':                self.id,
            'product_id':        self.product_id,
            'product_name':      self.product.name if self.product else None,
            'numero_lote':       self.numero_lote,
            'cantidad_inicial':  float(self.cantidad_inicial),
            'cantidad_actual':   float(self.cantidad_actual),
            'fecha_vencimiento': str(self.fecha_vencimiento) if self.fecha_vencimiento else None,
            'costo_unitario':    float(self.costo_unitario) if self.costo_unitario else None,
            'supplier_id':       self.supplier_id,
            'fecha_entrada':     str(self.fecha_entrada),
            'status':            self.status,
        }