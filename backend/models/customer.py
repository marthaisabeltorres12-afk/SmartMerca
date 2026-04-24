from extensions import db

class Customer(db.Model):
    __tablename__ = 'customers'

    id            = db.Column(db.Integer, primary_key=True)
    nid           = db.Column(db.String(20), unique=True, nullable=False)
    doc_type      = db.Column(db.Enum('CC','CE','NIT','Pasaporte'), default='CC')
    doc_number    = db.Column(db.String(30), unique=True, nullable=False)
    full_name     = db.Column(db.String(200), nullable=False)
    email         = db.Column(db.String(150), nullable=True)
    phone         = db.Column(db.String(20), nullable=True)
    address       = db.Column(db.Text, nullable=True)
    points        = db.Column(db.Integer, default=0)
    credit_limit  = db.Column(db.Numeric(10,2), default=0)
    credit_balance= db.Column(db.Numeric(10,2), default=0)
    price_list_id = db.Column(db.Integer, db.ForeignKey('price_lists.id'), nullable=True)
    is_active     = db.Column(db.Boolean, default=True)
    created_at    = db.Column(db.DateTime, server_default=db.func.now())

    credit_transactions = db.relationship('CreditTransaction', backref='customer',
                                          cascade='all, delete-orphan',
                                          order_by='CreditTransaction.created_at.desc()')

    def to_dict(self):
        return {
            'id':             self.id,
            'nid':            self.nid,
            'doc_type':       self.doc_type,
            'doc_number':     self.doc_number,
            'full_name':      self.full_name,
            'email':          self.email,
            'phone':          self.phone,
            'address':        self.address,
            'points':         self.points,
            'credit_limit':   float(self.credit_limit  or 0),
            'credit_balance':   float(self.credit_balance or 0),
            'credit_available': max(0, float(self.credit_limit or 0) - float(self.credit_balance or 0)),
            'price_list_id':  self.price_list_id,
            'price_list_nombre': self.price_list.nombre if self.price_list else None,
            'is_active':      self.is_active,
            'created_at':     str(self.created_at),
        }


class CreditTransaction(db.Model):
    __tablename__ = 'credit_transactions'

    id          = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    sale_id     = db.Column(db.Integer, db.ForeignKey('sales.id'),     nullable=True)
    type        = db.Column(db.Enum('credito','abono'), nullable=False)
    amount      = db.Column(db.Numeric(10,2), nullable=False)
    note        = db.Column(db.String(255))
    created_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at  = db.Column(db.DateTime, server_default=db.func.now())

    sale       = db.relationship('Sale',  foreign_keys=[sale_id])
    created_by_user = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id':          self.id,
            'customer_id': self.customer_id,
            'sale_id':     self.sale_id,
            'sale_total':  float(self.sale.total) if self.sale else None,
            'sale_date':   str(self.sale.created_at)[:10] if self.sale else None,
            'type':        self.type,
            'amount':      float(self.amount),
            'note':        self.note,
            'created_by':  self.created_by_user.name if self.created_by_user else None,
            'created_at':  str(self.created_at),
        }