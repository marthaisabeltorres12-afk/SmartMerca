from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'

    id                  = db.Column(db.Integer, primary_key=True)
    name                = db.Column(db.String(100), nullable=False)
    email               = db.Column(db.String(150), unique=True, nullable=False)
    password_hash       = db.Column(db.String(255), nullable=False)
    role                = db.Column(db.Enum('admin_tecnico', 'admin', 'cajero', 'bodeguero', 'supervisor', 'contador', 'auditor'), default='cajero', nullable=False)
    is_active           = db.Column(db.Boolean, default=True)
    approved            = db.Column(db.Boolean, default=False)
    reset_token         = db.Column(db.String(100), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    admin_pin           = db.Column(db.String(256), nullable=True)  # PIN 4-6 dígitos hasheado
    branch_id           = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    created_at          = db.Column(db.DateTime, server_default=db.func.now())
    pin                 = db.Column(db.String(10), nullable=True)
    branch = db.relationship('Branch', foreign_keys=[branch_id])

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def set_pin(self, pin):
        self.admin_pin = generate_password_hash(str(pin))

    def check_pin(self, pin):
        if not self.admin_pin:
            return False
        return check_password_hash(self.admin_pin, str(pin))

    def to_dict(self):
        role_labels = {
            'admin_tecnico': 'Administrador Técnico',
            'admin':         'Administrador de Tienda',
            'cajero':        'Cajero',
            'bodeguero':     'Bodeguero',
            'supervisor':    'Supervisor',
            'contador':      'Contador',
            'auditor':       'Auditor Externo',
        }
        return {
            'id':         self.id,
            'name':       self.name,
            'email':      self.email,
            'role':       self.role,
            'role_label': role_labels.get(self.role, self.role),
            'is_active':  self.is_active,
            'approved':   self.approved,
            'has_pin':    self.admin_pin is not None,
            'branch_id':  self.branch_id,
            'branch_name': self.branch.nombre if self.branch else None,
            'estado':     'Activo' if self.is_active else 'Desactivado',
            'created_at': str(self.created_at)
        }