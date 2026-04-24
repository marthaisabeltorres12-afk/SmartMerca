from flask import Blueprint
from controllers.location_controller import (
    get_locations, create_location, update_location,
    get_location_stock, get_product_locations,
    create_transfer, get_transfers
)

locations_bp = Blueprint('locations', __name__)

locations_bp.route('/',                                  methods=['GET'])(get_locations)
locations_bp.route('/',                                  methods=['POST'])(create_location)
locations_bp.route('/<int:id>',                          methods=['PUT'])(update_location)
locations_bp.route('/<int:location_id>/stock',           methods=['GET'])(get_location_stock)
locations_bp.route('/product/<int:product_id>',          methods=['GET'])(get_product_locations)
locations_bp.route('/transfers',                         methods=['GET'])(get_transfers)
locations_bp.route('/transfers',                         methods=['POST'])(create_transfer)