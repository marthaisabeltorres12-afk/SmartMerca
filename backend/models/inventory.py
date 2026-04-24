from extensions import db

class InventoryMovement(db.Model):
    __tablename__ = 'inventory_movements'

    id          = db.Column(db.Integer, primary_key=True)
    product_id  = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    type        = db.Column(db.Enum('entrada','salida'), nullable=False)
    quantity    = db.Column(db.Numeric(10,3), nullable=False)
    unit_cost   = db.Column(db.Numeric(10,2), nullable=True)
    expiry_date = db.Column(db.Date, nullable=True)
    reason      = db.Column(db.String(100))
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    created_at  = db.Column(db.DateTime, server_default=db.func.now())

    product  = db.relationship('Product')
    supplier = db.relationship('Supplier')

    def to_dict(self):
        return {
            'id':          self.id,
            'product_id':  self.product_id,
            'product':     self.product.name if self.product else None,
            'type':        self.type,
            'quantity':    float(self.quantity),
            'unit_cost':   float(self.unit_cost) if self.unit_cost else None,
            'total_cost':  float(self.unit_cost * self.quantity) if self.unit_cost else None,
            'expiry_date': str(self.expiry_date) if self.expiry_date else None,
            'reason':      self.reason,
            'supplier_id': self.supplier_id,
            'supplier':    self.supplier.company_name or self.supplier.name if self.supplier else None,
            'created_at':  str(self.created_at)
        }