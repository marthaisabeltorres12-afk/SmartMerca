from extensions import db

class CashClose(db.Model):
    __tablename__ = 'cash_closes'

    id               = db.Column(db.Integer, primary_key=True)
    cashier_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date             = db.Column(db.Date, nullable=False)
    system_total     = db.Column(db.Numeric(10,2), nullable=False, default=0)
    cash_counted     = db.Column(db.Numeric(10,2), nullable=False, default=0)
    difference       = db.Column(db.Numeric(10,2), nullable=False, default=0)
    observations     = db.Column(db.Text, nullable=True)
    status           = db.Column(db.Enum('pendiente','aprobado','rechazado'), default='pendiente')
    admin_comment    = db.Column(db.Text, nullable=True)
    reviewed_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at       = db.Column(db.DateTime, server_default=db.func.now())

    cashier  = db.relationship('User', foreign_keys=[cashier_id])
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])

    def to_dict(self):
        return {
            'id':            self.id,
            'cashier_id':    self.cashier_id,
            'cashier':       self.cashier.name if self.cashier else None,
            'date':          str(self.date),
            'system_total':  float(self.system_total),
            'cash_counted':  float(self.cash_counted),
            'difference':    float(self.difference),
            'observations':  self.observations,
            'status':        self.status,
            'admin_comment': self.admin_comment,
            'reviewed_by':   self.reviewed_by,
            'reviewer':      self.reviewer.name if self.reviewer else None,
            'created_at':    str(self.created_at),
        }