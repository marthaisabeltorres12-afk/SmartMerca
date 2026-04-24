from extensions import db
from datetime import datetime

class Location(db.Model):
    __tablename__ = 'locations'

    id                   = db.Column(db.Integer, primary_key=True)
    nombre               = db.Column(db.String(100), nullable=False)
    tipo                 = db.Column(db.Enum('bodega','sala','produccion','frio'), default='bodega')
    requiere_temperatura = db.Column(db.Boolean, default=False)
    is_active            = db.Column(db.Boolean, default=True)
    created_at           = db.Column(db.DateTime, default=datetime.now)

    stock_items  = db.relationship('LocationStock', backref='location', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':                   self.id,
            'nombre':               self.nombre,
            'tipo':                 self.tipo,
            'requiere_temperatura': self.requiere_temperatura,
            'is_active':            self.is_active,
        }


class LocationStock(db.Model):
    __tablename__ = 'location_stock'

    id          = db.Column(db.Integer, primary_key=True)
    product_id  = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    cantidad    = db.Column(db.Numeric(10, 3), default=0)
    updated_at  = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    product = db.relationship('Product')

    __table_args__ = (db.UniqueConstraint('product_id', 'location_id'),)

    def to_dict(self):
        return {
            'id':           self.id,
            'product_id':   self.product_id,
            'product_name': self.product.name if self.product else None,
            'location_id':  self.location_id,
            'location_nombre': self.location.nombre if self.location else None,
            'cantidad':     float(self.cantidad),
        }


class StockTransfer(db.Model):
    __tablename__ = 'stock_transfers'

    id               = db.Column(db.Integer, primary_key=True)
    product_id       = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    from_location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    to_location_id   = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    cantidad         = db.Column(db.Numeric(10, 3), nullable=False)
    motivo           = db.Column(db.String(200), nullable=True)
    created_by       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at       = db.Column(db.DateTime, default=datetime.now)

    product       = db.relationship('Product')
    from_location = db.relationship('Location', foreign_keys=[from_location_id])
    to_location   = db.relationship('Location', foreign_keys=[to_location_id])
    creator       = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id':               self.id,
            'product_id':       self.product_id,
            'product_name':     self.product.name if self.product else None,
            'from_location_id': self.from_location_id,
            'from_location':    self.from_location.nombre if self.from_location else None,
            'to_location_id':   self.to_location_id,
            'to_location':      self.to_location.nombre if self.to_location else None,
            'cantidad':         float(self.cantidad),
            'motivo':           self.motivo,
            'created_by_name':  self.creator.name if self.creator else None,
            'created_at':       str(self.created_at),
        }