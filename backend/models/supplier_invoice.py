from extensions import db
from datetime import datetime

class SupplierInvoice(db.Model):
    __tablename__ = 'supplier_invoices'

    id                        = db.Column(db.Integer, primary_key=True)
    supplier_id               = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    numero_factura_proveedor  = db.Column(db.String(50), nullable=False)
    valor_total               = db.Column(db.Numeric(12, 2), nullable=False)
    valor_pagado              = db.Column(db.Numeric(12, 2), default=0)
    fecha_factura             = db.Column(db.Date, nullable=False)
    fecha_vencimiento         = db.Column(db.Date, nullable=False)
    status                    = db.Column(db.Enum('pendiente','parcial','pagado','vencido'), default='pendiente')
    notas                     = db.Column(db.Text, nullable=True)
    created_at                = db.Column(db.DateTime, default=datetime.now)

    supplier = db.relationship('Supplier', backref='invoices')
    payments = db.relationship('SupplierPayment', backref='invoice', cascade='all, delete-orphan')

    def to_dict(self):
        saldo = float(self.valor_total) - float(self.valor_pagado)
        return {
            'id':                       self.id,
            'supplier_id':              self.supplier_id,
            'supplier_name':            self.supplier.company_name or self.supplier.name if self.supplier else None,
            'numero_factura_proveedor': self.numero_factura_proveedor,
            'valor_total':              float(self.valor_total),
            'valor_pagado':             float(self.valor_pagado),
            'saldo':                    round(saldo, 2),
            'fecha_factura':            str(self.fecha_factura),
            'fecha_vencimiento':        str(self.fecha_vencimiento),
            'status':                   self.status,
            'notas':                    self.notas,
            'created_at':               str(self.created_at),
            'payments':                 [p.to_dict() for p in self.payments],
        }


class SupplierPayment(db.Model):
    __tablename__ = 'supplier_payments'

    id                   = db.Column(db.Integer, primary_key=True)
    supplier_invoice_id  = db.Column(db.Integer, db.ForeignKey('supplier_invoices.id'), nullable=False)
    monto                = db.Column(db.Numeric(12, 2), nullable=False)
    fecha_pago           = db.Column(db.Date, nullable=False)
    metodo_pago          = db.Column(db.String(50), nullable=False)
    referencia_bancaria  = db.Column(db.String(100), nullable=True)
    registrado_por       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at           = db.Column(db.DateTime, default=datetime.now)

    registrador = db.relationship('User', foreign_keys=[registrado_por])

    def to_dict(self):
        return {
            'id':                  self.id,
            'supplier_invoice_id': self.supplier_invoice_id,
            'monto':               float(self.monto),
            'fecha_pago':          str(self.fecha_pago),
            'metodo_pago':         self.metodo_pago,
            'referencia_bancaria': self.referencia_bancaria,
            'registrado_por':      self.registrado_por,
            'registrado_por_nombre': self.registrador.name if self.registrador else None,
            'created_at':          str(self.created_at),
        }