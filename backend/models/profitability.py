from extensions import db
from datetime import datetime

class OperatingExpense(db.Model):
    __tablename__ = 'operating_expenses'

    id             = db.Column(db.Integer, primary_key=True)
    branch_id      = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    period         = db.Column(db.String(7), nullable=False)  # AAAA-MM
    tipo           = db.Column(db.Enum('arriendo','servicios','mantenimiento','empaque','publicidad','otros'), nullable=False)
    descripcion    = db.Column(db.String(200), nullable=True)
    valor          = db.Column(db.Numeric(12, 2), nullable=False)
    registrado_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at     = db.Column(db.DateTime, default=datetime.now)

    branch      = db.relationship('Branch', foreign_keys=[branch_id])
    registrador = db.relationship('User', foreign_keys=[registrado_por])

    def to_dict(self):
        return {
            'id':             self.id,
            'branch_id':      self.branch_id,
            'branch_name':    self.branch.nombre if self.branch else None,
            'period':         self.period,
            'tipo':           self.tipo,
            'descripcion':    self.descripcion,
            'valor':          float(self.valor),
            'registrado_por': self.registrado_por,
            'registrado_por_nombre': self.registrador.name if self.registrador else None,
            'created_at':     str(self.created_at),
        }


class BranchMonthlySummary(db.Model):
    __tablename__ = 'branch_monthly_summary'

    id                      = db.Column(db.Integer, primary_key=True)
    branch_id               = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    period                  = db.Column(db.String(7), nullable=False)
    ventas_brutas           = db.Column(db.Numeric(14, 2), default=0)
    devoluciones            = db.Column(db.Numeric(12, 2), default=0)
    ingresos_netos          = db.Column(db.Numeric(14, 2), default=0)
    costo_mercancia_vendida = db.Column(db.Numeric(14, 2), default=0)
    ganancia_bruta          = db.Column(db.Numeric(14, 2), default=0)
    margen_bruto_pct        = db.Column(db.Numeric(5, 2), default=0)
    total_nomina            = db.Column(db.Numeric(12, 2), default=0)
    total_merma             = db.Column(db.Numeric(12, 2), default=0)
    total_gastos_operativos = db.Column(db.Numeric(12, 2), default=0)
    ganancia_operativa      = db.Column(db.Numeric(14, 2), default=0)
    margen_operativo_pct    = db.Column(db.Numeric(5, 2), default=0)
    ticket_promedio         = db.Column(db.Numeric(10, 2), default=0)
    num_transacciones       = db.Column(db.Integer, default=0)
    es_proyeccion           = db.Column(db.Boolean, default=False)
    created_at              = db.Column(db.DateTime, default=datetime.now)

    branch = db.relationship('Branch', foreign_keys=[branch_id])

    __table_args__ = (db.UniqueConstraint('branch_id', 'period'),)

    def to_dict(self):
        return {
            'id':                      self.id,
            'branch_id':               self.branch_id,
            'branch_name':             self.branch.nombre if self.branch else None,
            'period':                  self.period,
            'ventas_brutas':           float(self.ventas_brutas),
            'devoluciones':            float(self.devoluciones),
            'ingresos_netos':          float(self.ingresos_netos),
            'costo_mercancia_vendida': float(self.costo_mercancia_vendida),
            'ganancia_bruta':          float(self.ganancia_bruta),
            'margen_bruto_pct':        float(self.margen_bruto_pct),
            'total_nomina':            float(self.total_nomina),
            'total_merma':             float(self.total_merma),
            'total_gastos_operativos': float(self.total_gastos_operativos),
            'ganancia_operativa':      float(self.ganancia_operativa),
            'margen_operativo_pct':    float(self.margen_operativo_pct),
            'ticket_promedio':         float(self.ticket_promedio),
            'num_transacciones':       self.num_transacciones,
            'es_proyeccion':           self.es_proyeccion,
        }