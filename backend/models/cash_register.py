from extensions import db
from datetime import datetime

# Tabla intermedia caja ↔ cajeros autorizados
cash_register_cajeros = db.Table(
    'cash_register_cajeros',
    db.Column('id',               db.Integer, primary_key=True),
    db.Column('cash_register_id', db.Integer, db.ForeignKey('cash_registers.id', ondelete='CASCADE')),
    db.Column('cajero_id',        db.Integer, db.ForeignKey('users.id',          ondelete='CASCADE')),
    db.Column('created_at',       db.DateTime, default=datetime.now),
    db.UniqueConstraint('cash_register_id', 'cajero_id', name='uq_caja_cajero'),
)

class CashRegister(db.Model):
    """Caja registradora con múltiples cajeros autorizados."""
    __tablename__ = 'cash_registers'

    id          = db.Column(db.Integer, primary_key=True)
    nombre      = db.Column(db.String(50), nullable=False)
    descripcion = db.Column(db.String(150), nullable=True)
    base_amount = db.Column(db.Numeric(10,2), default=0)
    branch_id   = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    is_active   = db.Column(db.Boolean, default=True)
    created_at  = db.Column(db.DateTime, default=datetime.now)

    branch  = db.relationship('Branch', foreign_keys=[branch_id])
    cajeros = db.relationship('User', secondary=cash_register_cajeros,
                              backref='cajas_autorizadas', lazy='joined')
    shifts  = db.relationship('Shift', backref='cash_register',
                              foreign_keys='Shift.cash_register_id',
                              lazy='dynamic')

    def get_cajero_ids(self):
        return [c.id for c in self.cajeros]

    def to_dict(self):
        turno_activo = self.shifts.filter_by(status='abierto').first()
        return {
            'id':           self.id,
            'nombre':       self.nombre,
            'descripcion':  self.descripcion,
            'base_amount':  float(self.base_amount or 0),
            'branch_id':    self.branch_id,
            'branch_name':  self.branch.nombre if self.branch else None,
            'is_active':    self.is_active,
            'created_at':   str(self.created_at),
            'cajeros':      [{'id': c.id, 'name': c.name} for c in self.cajeros],
            'cajero_ids':   self.get_cajero_ids(),
            'turno_activo': turno_activo.to_dict() if turno_activo else None,
            'cajero_actual':turno_activo.cashier.name if turno_activo else None,
        }