from extensions import db

class Supplier(db.Model):
    __tablename__ = 'suppliers'

    id           = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(150), nullable=True)
    name         = db.Column(db.String(150), nullable=False)
    contact_name = db.Column(db.String(100))
    email        = db.Column(db.String(150))
    phone        = db.Column(db.String(20))
    address      = db.Column(db.Text)
    nit          = db.Column(db.String(20), nullable=True)
    created_at   = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'id':           self.id,
            'company_name': self.company_name,
            'name':         self.name,
            'display_name': self.company_name or self.name,
            'contact_name': self.contact_name,
            'email':        self.email,
            'phone':        self.phone,
            'address':      self.address,
            'nit':          self.nit
        }