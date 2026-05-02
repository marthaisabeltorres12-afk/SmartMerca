from extensions import db

class Shift(db.Model):
    __tablename__ = 'shifts'

    id                = db.Column(db.Integer, primary_key=True)
    cashier_id        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    cash_register_id  = db.Column(db.Integer, db.ForeignKey('cash_registers.id'), nullable=True)  # ← NUEVO
    base_amount       = db.Column(db.Numeric(10,2), default=0)
    opened_at         = db.Column(db.DateTime, server_default=db.func.now())
    closed_at         = db.Column(db.DateTime, nullable=True)
    cash_counted      = db.Column(db.Numeric(10,2), nullable=True)
    total_sales       = db.Column(db.Numeric(10,2), default=0)
    total_cash        = db.Column(db.Numeric(10,2), default=0)
    total_card        = db.Column(db.Numeric(10,2), default=0)
    total_nequi       = db.Column(db.Numeric(10,2), default=0)
    total_transfer    = db.Column(db.Numeric(10,2), default=0)
    total_credit      = db.Column(db.Numeric(10,2), default=0)
    total_withdrawals = db.Column(db.Numeric(10,2), default=0)
    difference        = db.Column(db.Numeric(10,2), nullable=True)
    notes             = db.Column(db.Text, nullable=True)
    status                    = db.Column(db.Enum('abierto','pendiente_cierre','cerrado'), default='abierto')
    cashier_count_requested   = db.Column(db.Boolean, default=False)
    cash_counted_by_cashier   = db.Column(db.Numeric(10,2), nullable=True)
    branch_id                 = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    points_earned             = db.Column(db.Integer, default=0)

    cashier      = db.relationship('User', foreign_keys=[cashier_id])
    branch       = db.relationship('Branch', foreign_keys=[branch_id])
    withdrawals  = db.relationship('ShiftWithdrawal', backref='shift', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':               self.id,
            'cashier_id':       self.cashier_id,
            'cashier':          self.cashier.name if self.cashier else None,
            'cash_register_id': self.cash_register_id,
            'cash_register':    self.cash_register.nombre if hasattr(self, 'cash_register') and self.cash_register else None,
            'base_amount':      float(self.base_amount),
            'opened_at':        str(self.opened_at),
            'closed_at':        str(self.closed_at) if self.closed_at else None,
            'cash_counted':     float(self.cash_counted) if self.cash_counted is not None else None,
            'total_sales':      float(self.total_sales),
            'total_cash':       float(self.total_cash),
            'total_card':       float(self.total_card),
            'total_nequi':      float(self.total_nequi),
            'total_transfer':   float(self.total_transfer),
            'total_credit':     float(self.total_credit),
            'total_withdrawals':float(self.total_withdrawals),
            'difference':       float(self.difference) if self.difference is not None else None,
            'notes':            self.notes,
            'status':                     self.status,
            'cashier_count_requested':    self.cashier_count_requested,
            'cash_counted_by_cashier':    float(self.cash_counted_by_cashier) if self.cash_counted_by_cashier is not None else None,
            'branch_id':    self.branch_id,
            'branch_name':  self.branch.nombre if self.branch else None,
            'points_earned':self.points_earned or 0,
            'withdrawals':  [w.to_dict() for w in self.withdrawals],
        }


class ShiftWithdrawal(db.Model):
    __tablename__ = 'shift_withdrawals'

    id             = db.Column(db.Integer, primary_key=True)
    shift_id       = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=False)
    amount         = db.Column(db.Numeric(10,2), nullable=False)
    reason         = db.Column(db.String(255), nullable=False)
    authorized_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at     = db.Column(db.DateTime, server_default=db.func.now())

    authorizer = db.relationship('User', foreign_keys=[authorized_by])

    def to_dict(self):
        return {
            'id':            self.id,
            'shift_id':      self.shift_id,
            'amount':        float(self.amount),
            'reason':        self.reason,
            'authorized_by': self.authorized_by,
            'authorizer':    self.authorizer.name if self.authorizer else None,
            'created_at':    str(self.created_at),
        }