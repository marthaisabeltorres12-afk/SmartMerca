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

    def to_dict(self, next_opened_at=None):
        from models.sale import Sale
        from models.sale_payment import SalePayment

        def r50(n):
            import math
            n = float(n or 0)
            centena = math.floor(n / 100) * 100
            t = n - centena
            if t <= 24:   return int(centena)
            elif t <= 74: return int(centena + 50)
            else:         return int(centena + 100)

        q = Sale.query.filter(
            Sale.cashier_id == self.cashier_id,
            Sale.created_at >= self.opened_at
        )
        if self.closed_at:
            q = q.filter(Sale.created_at <= self.closed_at)
        elif next_opened_at:
            q = q.filter(Sale.created_at < next_opened_at)
        sales = q.all()

        total_sales = r50(sum(float(s.total) for s in sales))
        total_wd    = r50(sum(float(w.amount) for w in self.withdrawals))

        # Usar Sale.total por método — no SalePayment.monto que incluye cambio
        def pm(s, kw): return kw in (s.payment_method or '')
        total_cash     = r50(sum(float(s.total) for s in sales if pm(s,'efectivo') and not pm(s,'mixto')))
        total_card     = r50(sum(float(s.total) for s in sales if pm(s,'tarjeta')))
        total_nequi    = r50(sum(float(s.total) for s in sales if pm(s,'nequi') and not pm(s,'mixto')))
        total_transfer = r50(sum(float(s.total) for s in sales if pm(s,'transferencia') and not pm(s,'mixto')))
        total_credit   = r50(sum(float(s.total) for s in sales if pm(s,'credito')))

        # Pagos mixtos — distribuir por proporción
        sale_ids_mixto = [s.id for s in sales if pm(s,'mixto')]
        if sale_ids_mixto:
            from collections import defaultdict
            payments = SalePayment.query.filter(SalePayment.sale_id.in_(sale_ids_mixto)).all()
            by_sale = defaultdict(list)
            for p in payments:
                by_sale[p.sale_id].append(p)
            for sid, ps in by_sale.items():
                sale = next((s for s in sales if s.id == sid), None)
                if not sale: continue
                total_pagado = sum(float(p.monto) for p in ps)
                for p in ps:
                    m = (p.metodo or '').lower()
                    prop = float(p.monto) / total_pagado if total_pagado > 0 else 0
                    parte = float(sale.total) * prop
                    if m == 'efectivo':        total_cash     += r50(parte)
                    elif m == 'tarjeta':       total_card     += r50(parte)
                    elif m == 'nequi':         total_nequi    += r50(parte)
                    elif m == 'transferencia': total_transfer += r50(parte)

        cash_exp = r50(float(self.base_amount or 0) + total_cash - total_wd)
        if self.cash_counted_by_cashier is not None:
            difference = r50(float(self.cash_counted_by_cashier) - cash_exp)
        else:
            difference = r50(float(self.difference)) if self.difference is not None else None

        return {
            'id':               self.id,
            'cashier_id':       self.cashier_id,
            'cashier':          self.cashier.name if self.cashier else None,
            'cash_register_id': self.cash_register_id,
            'cash_register':    self.cash_register.nombre if hasattr(self, 'cash_register') and self.cash_register else None,
            'base_amount':      r50(self.base_amount),
            'opened_at':        str(self.opened_at),
            'closed_at':        str(self.closed_at) if self.closed_at else None,
            'cash_counted':     r50(self.cash_counted) if self.cash_counted is not None else None,
            'total_sales':      total_sales,
            'total_cash':       total_cash,
            'total_card':       total_card,
            'total_nequi':      total_nequi,
            'total_transfer':   total_transfer,
            'total_credit':     total_credit,
            'total_withdrawals':total_wd,
            'sales_count':      len(sales),
            'difference':       difference,
            'notes':            self.notes,
            'status':                     self.status,
            'cashier_count_requested':    self.cashier_count_requested,
            'cash_counted_by_cashier':    r50(self.cash_counted_by_cashier) if self.cash_counted_by_cashier is not None else None,
            'branch_id':    self.branch_id,
            'branch_name':  self.branch.nombre if self.branch else None,
            'points_earned':self.points_earned or 0,
            'withdrawals':  [w.to_dict() for w in self.withdrawals],
            'ajustes_ingreso': self._ajustes_ingreso(),
        }

    def _ajustes_ingreso(self):
        """Total de ajustes de ingreso vinculados a este turno."""
        try:
            from models.cash_adjustment import CashAdjustment
            total = sum(
                float(a.monto) for a in CashAdjustment.query
                .filter_by(relacionado_a_turno_id=self.id, tipo='ingreso').all()
            )
            return total
        except Exception:
            return 0


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