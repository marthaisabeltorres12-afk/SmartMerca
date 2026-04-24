from extensions import db
from datetime import datetime

class InventoryCount(db.Model):
    __tablename__ = 'inventory_counts'

    id            = db.Column(db.Integer, primary_key=True)
    nombre        = db.Column(db.String(100), nullable=False)
    seccion       = db.Column(db.String(100), nullable=True)
    location_id   = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=True)
    location_name = db.Column(db.String(100), nullable=True)
    origen        = db.Column(db.String(50), default='admin')  # 'admin' o 'bodeguero'
    status        = db.Column(db.Enum('en_progreso','conteo_terminado','ajustes_aprobados'), default='en_progreso')
    iniciado_por  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    aprobado_por  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at    = db.Column(db.DateTime, default=datetime.now)
    updated_at    = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    iniciador = db.relationship('User', foreign_keys=[iniciado_por])
    aprobador = db.relationship('User', foreign_keys=[aprobado_por])
    items     = db.relationship('InventoryCountItem', backref='count', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':            self.id,
            'nombre':        self.nombre,
            'seccion':       self.seccion,
            'location_id':   self.location_id,
            'location_name': self.location_name,
            'origen':        self.origen,
            'status':        self.status,
            'iniciado_por':  self.iniciado_por,
            'iniciador_nombre': self.iniciador.name if self.iniciador else None,
            'aprobado_por':  self.aprobado_por,
            'aprobador_nombre': self.aprobador.name if self.aprobador else None,
            'created_at':    str(self.created_at),
            'updated_at':    str(self.updated_at),
            'total_items':   len(self.items),
            'contados':      sum(1 for i in self.items if i.cantidad_contada is not None),
            'diferencias':   sum(1 for i in self.items if i.cantidad_contada is not None and float(i.diferencia or 0) != 0),
        }


class InventoryCountItem(db.Model):
    __tablename__ = 'inventory_count_items'

    id               = db.Column(db.Integer, primary_key=True)
    inventory_count_id = db.Column(db.Integer, db.ForeignKey('inventory_counts.id'), nullable=False)
    product_id       = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    stock_sistema    = db.Column(db.Numeric(10, 3), nullable=False)
    cantidad_contada = db.Column(db.Numeric(10, 3), nullable=True)
    diferencia       = db.Column(db.Numeric(10, 3), nullable=True)
    status_ajuste    = db.Column(db.Enum('pendiente','aprobado','rechazado'), default='pendiente')
    justificacion    = db.Column(db.Text, nullable=True)

    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id':                  self.id,
            'inventory_count_id':  self.inventory_count_id,
            'product_id':          self.product_id,
            'product_name':        self.product.name if self.product else None,
            'product_category':    self.product.category if self.product else None,
            'stock_sistema':       float(self.stock_sistema),
            'cantidad_contada':    float(self.cantidad_contada) if self.cantidad_contada is not None else None,
            'diferencia':          float(self.diferencia) if self.diferencia is not None else None,
            'status_ajuste':       self.status_ajuste,
            'justificacion':       self.justificacion,
        }