from flask import Flask, request, Response
from extensions import db, jwt, mail
from config import Config
from routes.audit_routes        import audit_bp
from routes.auth                import auth_bp
from routes.products            import products_bp
from routes.suppliers           import suppliers_bp
from routes.users               import users_bp
from routes.sales               import sales_bp
from routes.inventory           import inventory_bp
from routes.cash_closes         import cash_closes_bp
from routes.customers           import customers_bp
from routes.returns             import returns_bp
from routes.backup              import backup_bp
from routes.pin_routes          import pin_bp
from routes.credit_routes       import credit_bp
from routes.presentation_routes import presentations_bp
from routes.shift_routes        import shifts_bp
from routes.finance_routes      import finance_bp
from routes.cash_adjustments    import cash_adjustments_bp
from routes.dashboard_routes    import dashboard_bp
from routes.supplier_invoice_routes import supplier_invoices_bp
from routes.shrinkage_routes        import shrinkage_bp
from routes.price_list_routes       import price_lists_bp
from routes.purchase_order_routes   import purchase_orders_bp
from routes.inventory_count_routes  import inventory_counts_bp
from routes.location_routes         import locations_bp
from routes.branch_routes           import branches_bp
from routes.payroll_routes          import payroll_bp
from routes.profitability_routes    import profitability_bp
from routes.replenishment_routes    import replenishment_bp
from routes.coupon_routes           import coupons_bp
from routes.authorization_routes    import auth_admin_bp
from routes.import_export_routes    import import_export_bp
from routes.multicaja_routes import multicaja_bp
from routes.reservas_routes import reservas_bp
from routes.whatsapp_routes import whatsapp_bp
from routes.predictive_routes import predictive_bp
try:
    from routes.promotions    import promotions_bp
    from routes.policy        import policy_bp
    from routes.system_config import system_config_bp
    from routes.import_routes import import_bp
    from routes.lines_routes  import lines_bp
    _extras = True
except ImportError:
    _extras = False

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    app.register_blueprint(predictive_bp, url_prefix='/api/dashboard')
    app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
    app.register_blueprint(reservas_bp, url_prefix='/api/reservas')
    app.register_blueprint(multicaja_bp, url_prefix='/api/cajas')
    app.register_blueprint(auth_bp,              url_prefix='/api/auth')
    app.register_blueprint(products_bp,          url_prefix='/api/products')
    app.register_blueprint(suppliers_bp,         url_prefix='/api/suppliers')
    app.register_blueprint(users_bp,             url_prefix='/api/users')
    app.register_blueprint(sales_bp,             url_prefix='/api/sales')
    app.register_blueprint(inventory_bp,         url_prefix='/api/inventory')
    app.register_blueprint(cash_closes_bp,       url_prefix='/api/cash-closes')
    app.register_blueprint(customers_bp,         url_prefix='/api/customers')
    app.register_blueprint(returns_bp,           url_prefix='/api/returns')
    app.register_blueprint(backup_bp,            url_prefix='/api/backup')
    app.register_blueprint(pin_bp,               url_prefix='/api/pin')
    app.register_blueprint(credit_bp,            url_prefix='/api/credit')
    app.register_blueprint(presentations_bp,     url_prefix='/api/presentations')
    app.register_blueprint(shifts_bp,            url_prefix='/api/shifts')
    app.register_blueprint(finance_bp,           url_prefix='/api/finance')
    app.register_blueprint(cash_adjustments_bp,  url_prefix='/api/cash-adjustments')
    app.register_blueprint(dashboard_bp,         url_prefix='/api/dashboard')
    app.register_blueprint(supplier_invoices_bp, url_prefix='/api/supplier-invoices')
    app.register_blueprint(shrinkage_bp,         url_prefix='/api/shrinkage')
    app.register_blueprint(price_lists_bp,       url_prefix='/api/price-lists')
    app.register_blueprint(purchase_orders_bp,   url_prefix='/api/purchase-orders')
    app.register_blueprint(inventory_counts_bp,  url_prefix='/api/inventory-counts')
    app.register_blueprint(locations_bp,         url_prefix='/api/locations')
    app.register_blueprint(branches_bp,          url_prefix='/api/branches')
    app.register_blueprint(payroll_bp,           url_prefix='/api/payroll')
    app.register_blueprint(profitability_bp,     url_prefix='/api/profitability')
    app.register_blueprint(replenishment_bp,     url_prefix='/api/replenishment')
    app.register_blueprint(auth_admin_bp,        url_prefix='/api/auth-admin')
    app.register_blueprint(import_export_bp,     url_prefix='/api/import-export')

    from routes.catalogo_routes     import catalogo_bp
    from routes.notificacion_routes import notificaciones_bp
    app.register_blueprint(notificaciones_bp, url_prefix='/api/notificaciones')
    app.register_blueprint(catalogo_bp,       url_prefix='/api/catalogo')
    app.register_blueprint(audit_bp,          url_prefix='/api/audit')

    from flask_cors import CORS
    CORS(app, resources={r"/api/catalogo/*": {"origins": "*"}})

    if _extras:
        app.register_blueprint(promotions_bp,    url_prefix='/api/promotions')
        app.register_blueprint(policy_bp,        url_prefix='/api/policy')
        app.register_blueprint(system_config_bp, url_prefix='/api/system-config')
        app.register_blueprint(import_bp,        url_prefix='/api/import')
        app.register_blueprint(lines_bp,         url_prefix='/api/lines')

    with app.app_context():
        from models.user             import User
        from models.product          import Product
        from models.supplier         import Supplier
        from models.sale             import Sale, SaleItem
        from models.inventory        import InventoryMovement
        from models.customer         import Customer
        from models.return_order     import ReturnOrder, ReturnItem
        from models.cash_close       import CashClose
        from models.audit_log        import AuditLog
        from models.cash_adjustment  import CashAdjustment
        from models.sale_payment     import SalePayment
        from models.supplier_invoice import SupplierInvoice, SupplierPayment
        from models.shrinkage        import ShrinkageRecord
        from models.price_list       import PriceList, PriceListItem
        from models.purchase_order   import PurchaseOrder, PurchaseOrderItem
        from models.inventory_batch  import InventoryBatch
        from models.inventory_count  import InventoryCount, InventoryCountItem
        from models.location         import Location, LocationStock, StockTransfer
        from models.branch           import Branch, CashierPoints
        from models.payroll          import Employee, PayrollPeriod, PayrollRecord, PayrollNovedad, LiquidacionLaboral
        from models.profitability    import OperatingExpense, BranchMonthlySummary
        from models.price_history    import PriceHistory
        from models.notificacion     import Notificacion
        from models.coupon           import LoyaltyCoupon
        from models.admin_card       import AdminCard
        from models.cash_register import CashRegister
        try:
            from models.customer     import CreditTransaction
            from models.presentation import ProductPresentation
            from models.shift        import Shift, ShiftWithdrawal
        except ImportError:
            pass
        db.create_all()

    return app


app = create_app()

@app.route("/")
def home():
    return "API funcionando 🚀"

@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        res = Response()
        res.headers["Access-Control-Allow-Origin"]  = "*"
        res.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return res

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)