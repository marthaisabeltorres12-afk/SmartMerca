from extensions import db
from datetime import datetime, date

# ── Parámetros legales Colombia 2026 ─────────────────────────────────────
SMMLV              = 1_423_500
AUXILIO_TRANSPORTE = 200_000
UVT                = 49_799

PCT_SALUD_EMP      = 0.04
PCT_PENSION_EMP    = 0.04
PCT_SALUD_EMPR     = 0.085
PCT_PENSION_EMPR   = 0.12
PCT_ARL            = 0.00522
PCT_CAJA           = 0.04
PCT_SENA           = 0.02
PCT_ICBF           = 0.03
FACTOR_HED         = 1.25
FACTOR_HEN         = 1.75
FACTOR_HDDF        = 2.00
FACTOR_HNDF        = 2.50
FACTOR_RNOCTURNO   = 0.35
PCT_PRIMA          = 1/12
PCT_CESANTIAS      = 1/12
PCT_INT_CESANTIAS  = 0.12
PCT_VACACIONES     = 0.0417


class Employee(db.Model):
    __tablename__ = 'employees'
    id                          = db.Column(db.Integer, primary_key=True)
    user_id                     = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    cedula                      = db.Column(db.String(20), nullable=False)
    fecha_nacimiento            = db.Column(db.Date, nullable=True)
    direccion                   = db.Column(db.String(200), nullable=True)
    telefono                    = db.Column(db.String(20), nullable=True)
    contacto_emergencia         = db.Column(db.String(100), nullable=True)
    nombre_contacto_emergencia  = db.Column(db.String(100), nullable=True)
    fecha_inicio_contrato       = db.Column(db.Date, nullable=False)
    tipo_contrato               = db.Column(db.Enum('fijo','indefinido','obra','aprendizaje','prestacion_servicios'), default='indefinido')
    cargo_oficial               = db.Column(db.String(100), nullable=True)
    salario_base                = db.Column(db.Numeric(12, 2), nullable=False)
    tiene_auxilio_transporte    = db.Column(db.Boolean, default=True)
    cuenta_bancaria             = db.Column(db.String(30), nullable=True)
    banco                       = db.Column(db.String(50), nullable=True)
    eps                         = db.Column(db.String(50), nullable=True)
    numero_eps                  = db.Column(db.String(20), nullable=True)
    fondo_pensiones             = db.Column(db.String(50), nullable=True)
    numero_pensiones            = db.Column(db.String(20), nullable=True)
    arl                         = db.Column(db.String(50), nullable=True)
    caja_compensacion           = db.Column(db.String(50), nullable=True)
    clase_riesgo_arl            = db.Column(db.Integer, default=1)
    estado                      = db.Column(db.Enum('activo','vacaciones','incapacidad','retirado'), default='activo')
    fecha_retiro                = db.Column(db.Date, nullable=True)
    motivo_retiro               = db.Column(db.String(200), nullable=True)
    created_at                  = db.Column(db.DateTime, default=datetime.now)
    user = db.relationship('User', backref='employee')

    @property
    def meses_trabajados(self):
        fin = self.fecha_retiro or date.today()
        return max(0, (fin.year - self.fecha_inicio_contrato.year)*12 + (fin.month - self.fecha_inicio_contrato.month))

    def to_dict(self):
        return {
            'id': self.id, 'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'user_email': self.user.email if self.user else None,
            'cedula': self.cedula,
            'fecha_nacimiento': str(self.fecha_nacimiento) if self.fecha_nacimiento else None,
            'direccion': self.direccion, 'telefono': self.telefono,
            'contacto_emergencia': self.contacto_emergencia,
            'nombre_contacto_emergencia': self.nombre_contacto_emergencia,
            'fecha_inicio_contrato': str(self.fecha_inicio_contrato),
            'tipo_contrato': self.tipo_contrato, 'cargo_oficial': self.cargo_oficial,
            'salario_base': float(self.salario_base),
            'tiene_auxilio_transporte': self.tiene_auxilio_transporte,
            'cuenta_bancaria': self.cuenta_bancaria, 'banco': self.banco,
            'eps': self.eps, 'fondo_pensiones': self.fondo_pensiones,
            'arl': self.arl, 'caja_compensacion': self.caja_compensacion,
            'clase_riesgo_arl': self.clase_riesgo_arl,
            'estado': self.estado,
            'fecha_retiro': str(self.fecha_retiro) if self.fecha_retiro else None,
            'motivo_retiro': self.motivo_retiro,
            'meses_trabajados': self.meses_trabajados,
        }


class PayrollPeriod(db.Model):
    __tablename__ = 'payroll_periods'
    id           = db.Column(db.Integer, primary_key=True)
    period       = db.Column(db.String(50), nullable=False, unique=True)
    fecha_inicio = db.Column(db.Date, nullable=False)
    fecha_fin    = db.Column(db.Date, nullable=False)
    status       = db.Column(db.Enum('abierto','calculado','pagado'), default='abierto')
    cerrado_por  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.now)
    records  = db.relationship('PayrollRecord', backref='period_obj', cascade='all, delete-orphan')
    cerrador = db.relationship('User', foreign_keys=[cerrado_por])

    def to_dict(self):
        return {
            'id': self.id, 'period': self.period,
            'fecha_inicio': str(self.fecha_inicio), 'fecha_fin': str(self.fecha_fin),
            'status': self.status, 'cerrado_por': self.cerrado_por,
            'total_records': len(self.records),
            'total_neto': sum(float(r.neto_a_pagar or 0) for r in self.records),
            'total_devengado': sum(float(r.total_devengado or 0) for r in self.records),
            'total_deducciones': sum(float(r.total_deducciones or 0) for r in self.records),
            'costo_total_empleador': sum(float(r.costo_total_empleador or 0) for r in self.records),
        }


class PayrollRecord(db.Model):
    __tablename__ = 'payroll_records'
    id                           = db.Column(db.Integer, primary_key=True)
    period_id                    = db.Column(db.Integer, db.ForeignKey('payroll_periods.id'), nullable=False)
    employee_id                  = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    dias_trabajados              = db.Column(db.Integer, default=30)
    salario_base_proporcional    = db.Column(db.Numeric(12,2), default=0)
    auxilio_transporte           = db.Column(db.Numeric(10,2), default=0)
    bonificaciones               = db.Column(db.Numeric(10,2), default=0)
    comisiones                   = db.Column(db.Numeric(10,2), default=0)
    horas_extras_diurnas_qty     = db.Column(db.Numeric(5,2), default=0)
    horas_extras_diurnas_valor   = db.Column(db.Numeric(10,2), default=0)
    horas_extras_nocturnas_qty   = db.Column(db.Numeric(5,2), default=0)
    horas_extras_nocturnas_valor = db.Column(db.Numeric(10,2), default=0)
    horas_dominicales_qty        = db.Column(db.Numeric(5,2), default=0)
    horas_dominicales_valor      = db.Column(db.Numeric(10,2), default=0)
    recargo_nocturno_qty         = db.Column(db.Numeric(5,2), default=0)
    recargo_nocturno_valor       = db.Column(db.Numeric(10,2), default=0)
    recargo_dominical_valor      = db.Column(db.Numeric(10,2), default=0)
    deduccion_salud              = db.Column(db.Numeric(10,2), default=0)
    deduccion_pension            = db.Column(db.Numeric(10,2), default=0)
    otros_descuentos             = db.Column(db.Numeric(10,2), default=0)
    adelanto_salario             = db.Column(db.Numeric(10,2), default=0)
    aporte_salud_empleador       = db.Column(db.Numeric(10,2), default=0)
    aporte_pension_empleador     = db.Column(db.Numeric(10,2), default=0)
    aporte_arl                   = db.Column(db.Numeric(10,2), default=0)
    aporte_caja                  = db.Column(db.Numeric(10,2), default=0)
    aporte_sena                  = db.Column(db.Numeric(10,2), default=0)
    aporte_icbf                  = db.Column(db.Numeric(10,2), default=0)
    prima_servicios              = db.Column(db.Numeric(10,2), default=0)
    cesantias                    = db.Column(db.Numeric(10,2), default=0)
    intereses_cesantias          = db.Column(db.Numeric(10,2), default=0)
    vacaciones                   = db.Column(db.Numeric(10,2), default=0)
    total_devengado              = db.Column(db.Numeric(12,2), default=0)
    total_deducciones            = db.Column(db.Numeric(12,2), default=0)
    costo_total_empleador        = db.Column(db.Numeric(12,2), default=0)
    neto_a_pagar                 = db.Column(db.Numeric(12,2), default=0)
    metodo_pago                  = db.Column(db.String(50), nullable=True)
    referencia_pago              = db.Column(db.String(100), nullable=True)
    fecha_pago                   = db.Column(db.Date, nullable=True)
    status                       = db.Column(db.Enum('pendiente','pagado'), default='pendiente')
    employee = db.relationship('Employee')

    def to_dict(self):
        emp = self.employee
        return {
            'id': self.id, 'period_id': self.period_id, 'employee_id': self.employee_id,
            'employee_name': emp.user.name if emp and emp.user else None,
            'cedula': emp.cedula if emp else None,
            'cargo': emp.cargo_oficial if emp else None,
            'salario_base': float(emp.salario_base) if emp else 0,
            'dias_trabajados': self.dias_trabajados,
            'salario_base_proporcional': float(self.salario_base_proporcional),
            'auxilio_transporte': float(self.auxilio_transporte),
            'bonificaciones': float(self.bonificaciones),
            'comisiones': float(self.comisiones),
            'horas_extras_diurnas_qty': float(self.horas_extras_diurnas_qty),
            'horas_extras_diurnas_valor': float(self.horas_extras_diurnas_valor),
            'horas_extras_nocturnas_qty': float(self.horas_extras_nocturnas_qty),
            'horas_extras_nocturnas_valor': float(self.horas_extras_nocturnas_valor),
            'horas_dominicales_qty': float(self.horas_dominicales_qty),
            'horas_dominicales_valor': float(self.horas_dominicales_valor),
            'recargo_nocturno_qty': float(self.recargo_nocturno_qty),
            'recargo_nocturno_valor': float(self.recargo_nocturno_valor),
            'recargo_dominical_valor': float(self.recargo_dominical_valor),
            'deduccion_salud': float(self.deduccion_salud),
            'deduccion_pension': float(self.deduccion_pension),
            'otros_descuentos': float(self.otros_descuentos),
            'adelanto_salario': float(self.adelanto_salario),
            'aporte_salud_empleador': float(self.aporte_salud_empleador),
            'aporte_pension_empleador': float(self.aporte_pension_empleador),
            'aporte_arl': float(self.aporte_arl),
            'aporte_caja': float(self.aporte_caja),
            'aporte_sena': float(self.aporte_sena),
            'aporte_icbf': float(self.aporte_icbf),
            'prima_servicios': float(self.prima_servicios),
            'cesantias': float(self.cesantias),
            'intereses_cesantias': float(self.intereses_cesantias),
            'vacaciones': float(self.vacaciones),
            'total_devengado': float(self.total_devengado),
            'total_deducciones': float(self.total_deducciones),
            'costo_total_empleador': float(self.costo_total_empleador),
            'neto_a_pagar': float(self.neto_a_pagar),
            'metodo_pago': self.metodo_pago,
            'referencia_pago': self.referencia_pago,
            'fecha_pago': str(self.fecha_pago) if self.fecha_pago else None,
            'status': self.status,
        }


class PayrollNovedad(db.Model):
    __tablename__ = 'payroll_novedades'
    id              = db.Column(db.Integer, primary_key=True)
    period_id       = db.Column(db.Integer, db.ForeignKey('payroll_periods.id'), nullable=False)
    employee_id     = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    tipo            = db.Column(db.Enum(
        'incapacidad_general','incapacidad_laboral',
        'licencia_maternidad','licencia_paternidad','licencia_no_remunerada',
        'ausencia_injustificada','permiso_remunerado',
        'vacaciones','bonificacion','comision',
        'prestamo','embargo','adelanto'
    ), nullable=False)
    dias_afectados  = db.Column(db.Integer, nullable=True)
    valor           = db.Column(db.Numeric(10,2), default=0)
    descripcion     = db.Column(db.Text, nullable=True)
    registrado_por  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at      = db.Column(db.DateTime, default=datetime.now)
    employee    = db.relationship('Employee', foreign_keys=[employee_id])
    registrador = db.relationship('User', foreign_keys=[registrado_por])

    def to_dict(self):
        return {
            'id': self.id, 'period_id': self.period_id, 'employee_id': self.employee_id,
            'employee_name': self.employee.user.name if self.employee and self.employee.user else None,
            'tipo': self.tipo, 'dias_afectados': self.dias_afectados,
            'valor': float(self.valor), 'descripcion': self.descripcion,
            'registrado_por': self.registrado_por,
            'created_at': str(self.created_at),
        }


class LiquidacionLaboral(db.Model):
    __tablename__ = 'liquidaciones_laborales'
    id                      = db.Column(db.Integer, primary_key=True)
    employee_id             = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    fecha_liquidacion       = db.Column(db.Date, nullable=False)
    motivo_retiro           = db.Column(db.String(200), nullable=True)
    dias_trabajados_total   = db.Column(db.Integer, default=0)
    ultimo_salario          = db.Column(db.Numeric(12,2), default=0)
    cesantias_pendientes    = db.Column(db.Numeric(12,2), default=0)
    intereses_cesantias     = db.Column(db.Numeric(10,2), default=0)
    prima_pendiente         = db.Column(db.Numeric(12,2), default=0)
    vacaciones_pendientes   = db.Column(db.Numeric(12,2), default=0)
    indemnizacion           = db.Column(db.Numeric(12,2), default=0)
    otros_conceptos         = db.Column(db.Numeric(12,2), default=0)
    total_liquidacion       = db.Column(db.Numeric(12,2), default=0)
    pagado                  = db.Column(db.Boolean, default=False)
    fecha_pago              = db.Column(db.Date, nullable=True)
    created_by              = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at              = db.Column(db.DateTime, default=datetime.now)
    employee = db.relationship('Employee')
    creator  = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id': self.id, 'employee_id': self.employee_id,
            'employee_name': self.employee.user.name if self.employee and self.employee.user else None,
            'fecha_liquidacion': str(self.fecha_liquidacion),
            'motivo_retiro': self.motivo_retiro,
            'dias_trabajados_total': self.dias_trabajados_total,
            'ultimo_salario': float(self.ultimo_salario),
            'cesantias_pendientes': float(self.cesantias_pendientes),
            'intereses_cesantias': float(self.intereses_cesantias),
            'prima_pendiente': float(self.prima_pendiente),
            'vacaciones_pendientes': float(self.vacaciones_pendientes),
            'indemnizacion': float(self.indemnizacion),
            'otros_conceptos': float(self.otros_conceptos),
            'total_liquidacion': float(self.total_liquidacion),
            'pagado': self.pagado,
            'fecha_pago': str(self.fecha_pago) if self.fecha_pago else None,
        }