from extensions import db
from datetime import datetime

class PurchaseOrder(db.Model):
    __tablename__ = 'purchase_orders'

    id              = db.Column(db.Integer, primary_key=True)
    numero_orden    = db.Column(db.String(20), unique=True, nullable=False)
    supplier_id     = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    status          = db.Column(db.Enum('borrador','enviada','parcial','completada','cancelada'), default='borrador')
    fecha_esperada  = db.Column(db.Date, nullable=True)
    notas           = db.Column(db.Text, nullable=True)
    created_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at      = db.Column(db.DateTime, default=datetime.now)

    supplier  = db.relationship('Supplier', backref='purchase_orders')
    creator   = db.relationship('User', foreign_keys=[created_by])
    approver  = db.relationship('User', foreign_keys=[approved_by])
    items     = db.relationship('PurchaseOrderItem', backref='order', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':             self.id,
            'numero_orden':   self.numero_orden,
            'supplier_id':    self.supplier_id,
            'supplier_name':  self.supplier.company_name or self.supplier.name if self.supplier else None,
            'status':         self.status,
            'fecha_esperada': str(self.fecha_esperada) if self.fecha_esperada else None,
            'notas':          self.notas,
            'created_by':     self.created_by,
            'created_by_name': self.creator.name if self.creator else None,
            'approved_by':    self.approved_by,
            'created_at':     str(self.created_at),
            'items':          [i.to_dict() for i in self.items],
            'total_items':    len(self.items),
            'valor_total':    sum(float(i.cantidad_solicitada) * float(i.precio_costo_acordado or 0) for i in self.items),
        }


class PurchaseOrderItem(db.Model):
    __tablename__ = 'purchase_order_items'

    id                    = db.Column(db.Integer, primary_key=True)
    purchase_order_id     = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=False)
    product_id            = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    cantidad_solicitada   = db.Column(db.Numeric(10, 3), nullable=False)
    cantidad_recibida     = db.Column(db.Numeric(10, 3), default=0)
    precio_costo_acordado = db.Column(db.Numeric(10, 2), nullable=True)
    notas                 = db.Column(db.Text, nullable=True)

    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id':                     self.id,
            'purchase_order_id':      self.purchase_order_id,
            'product_id':             self.product_id,
            'product_name':           self.product.name if self.product else None,
            'product_stock':          self.product.stock if self.product else 0,
            'product_min_stock':      self.product.min_stock if self.product else 0,
            'cantidad_solicitada':    float(self.cantidad_solicitada),
            'cantidad_recibida':      float(self.cantidad_recibida),
            'pendiente':              float(self.cantidad_solicitada) - float(self.cantidad_recibida),
            'precio_costo_acordado':  float(self.precio_costo_acordado) if self.precio_costo_acordado else None,
            'notas':                  self.notas,
        }