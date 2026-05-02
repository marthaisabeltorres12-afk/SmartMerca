from extensions import db
from datetime import datetime
import secrets

class AdminCard(db.Model):
    __tablename__ = 'admin_cards'

    id         = db.Column(db.Integer, primary_key=True)
    admin_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    code       = db.Column(db.String(50), unique=True, nullable=False)  # ej: ADMIN-784512
    is_active  = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    admin = db.relationship('User', foreign_keys=[admin_id])

    @staticmethod
    def generate_code():
        return f"ADMIN-{secrets.token_hex(3).upper()}"

    def to_dict(self):
        return {
            'id':        self.id,
            'admin_id':  self.admin_id,
            'admin_name':self.admin.name if self.admin else None,
            'code':      self.code,
            'is_active': self.is_active,
            'created_at':str(self.created_at),
        }