from extensions import db

class ReturnOrder(db.Model):
    __tablename__ = 'return_orders'

    id           = db.Column(db.Integer, primary_key=True)
    sale_id      = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=False)
    cashier_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    customer_id  = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    reason       = db.Column(db.String(255), nullable=True)
    mode         = db.Column(db.Enum('dinero', 'cambio'), default='dinero')
    total        = db.Column(db.Numeric(10,2), default=0)
    created_at   = db.Column(db.DateTime, server_default=db.func.now())

    sale     = db.relationship('Sale')
    cashier  = db.relationship('User')
    customer = db.relationship('Customer')
    items    = db.relationship('ReturnItem', backref='return_order', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':          self.id,
            'sale_id':     self.sale_id,
            'cashier_id':  self.cashier_id,
            'cashier':     self.cashier.name if self.cashier else None,
            'customer_id': self.customer_id,
            'customer':    self.customer.full_name if self.customer else None,
            'reason':      self.reason,
            'mode':        self.mode,
            'total':       float(self.total),
            'items':       [i.to_dict() for i in self.items],
            'created_at':  str(self.created_at),
        }

class ReturnItem(db.Model):
    __tablename__ = 'return_items'

    id              = db.Column(db.Integer, primary_key=True)
    return_order_id = db.Column(db.Integer, db.ForeignKey('return_orders.id'), nullable=False)
    product_id      = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    product_name    = db.Column(db.String(150), nullable=True)
    quantity        = db.Column(db.Numeric(10,3), nullable=False)
    price           = db.Column(db.Numeric(10,2), nullable=False)

    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id':           self.id,
            'product_id':   self.product_id,
            'product_name': self.product_name,
            'quantity':     float(self.quantity),
            'price':        float(self.price),
            'subtotal':     float(self.price * self.quantity),
        }