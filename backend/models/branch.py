from extensions import db
from datetime import datetime

class Branch(db.Model):
    __tablename__ = 'branches'

    id                  = db.Column(db.Integer, primary_key=True)
    nombre              = db.Column(db.String(100), nullable=False)
    direccion           = db.Column(db.String(200), nullable=True)
    ciudad              = db.Column(db.String(100), nullable=True)
    telefono            = db.Column(db.String(20), nullable=True)
    meta_ventas_mensual = db.Column(db.Numeric(12, 2), nullable=True)
    is_active           = db.Column(db.Boolean, default=True)
    created_at          = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id':                   self.id,
            'nombre':               self.nombre,
            'direccion':            self.direccion,
            'ciudad':               self.ciudad,
            'telefono':             self.telefono,
            'meta_ventas_mensual':  float(self.meta_ventas_mensual) if self.meta_ventas_mensual else None,
            'is_active':            self.is_active,
        }


class CashierPoints(db.Model):
    __tablename__ = 'cashier_points'

    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    branch_id       = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    period          = db.Column(db.String(7), nullable=False)  # AAAA-MM
    total_sales     = db.Column(db.Integer, default=0)
    total_amount    = db.Column(db.Numeric(12, 2), default=0)
    avg_ticket      = db.Column(db.Numeric(10, 2), default=0)
    points_earned   = db.Column(db.Integer, default=0)
    rank_in_branch  = db.Column(db.Integer, nullable=True)
    rank_global     = db.Column(db.Integer, nullable=True)
    updated_at      = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    user   = db.relationship('User', foreign_keys=[user_id])
    branch = db.relationship('Branch', foreign_keys=[branch_id])

    __table_args__ = (db.UniqueConstraint('user_id', 'period'),)

    def to_dict(self):
        return {
            'id':            self.id,
            'user_id':       self.user_id,
            'user_name':     self.user.name if self.user else None,
            'branch_id':     self.branch_id,
            'branch_name':   self.branch.nombre if self.branch else None,
            'period':        self.period,
            'total_sales':   self.total_sales,
            'total_amount':  float(self.total_amount),
            'avg_ticket':    float(self.avg_ticket),
            'points_earned': self.points_earned,
            'rank_in_branch':self.rank_in_branch,
            'rank_global':   self.rank_global,
        }