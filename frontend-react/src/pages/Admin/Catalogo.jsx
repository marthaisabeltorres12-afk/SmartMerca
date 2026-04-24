import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const Catalogo = () => {
  const { token } = useAuth();
  const [ip,       setIp]       = useState('localhost');
  const [products, setProducts] = useState([]);
  const [copied,   setCopied]   = useState(false);

  const catalogUrl = `http://${ip}:3000/catalogo.html`;

  useEffect(() => {
    // Obtener IP local del servidor
    apiFetch('/catalogo/productos', {}, null)
      .then(data => setProducts(data.products || []))
      .catch(() => {});

    // Intentar detectar IP local
    fetch('/api/catalogo/productos')
      .then(() => {
        const host = window.location.hostname;
        setIp(host);
      })
      .catch(() => {});
  }, [token]);

  const copyUrl = () => {
    navigator.clipboard.writeText(catalogUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openCatalog = () => window.open(catalogUrl, '_blank');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(catalogUrl)}`;

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>

        <div className="mb-4">
          <h4 className="fw-bold mb-0">🛒 Catálogo en línea</h4>
          <small className="text-muted">Los clientes escanean el QR y ven tus productos desde su celular</small>
        </div>

        <div className="row g-4">
          {/* QR y URL */}
          <div className="col-md-5">
            <div className="card border-0 shadow-sm text-center">
              <div className="card-body py-4">
                <h5 className="fw-bold mb-3">📱 Código QR para clientes</h5>
                <div className="p-3 d-inline-block rounded" style={{background:'#fff', border:'3px solid #1e3a5f'}}>
                  <img src={qrUrl} alt="QR Catálogo" style={{width:200, height:200}} />
                </div>
                <p className="text-muted small mt-3 mb-3">
                  El cliente escanea con la cámara del celular y ve los productos
                </p>
                <div className="input-group mb-3">
                  <input type="text" className="form-control form-control-sm text-muted"
                    value={catalogUrl} readOnly style={{fontSize:12}} />
                  <button className="btn btn-outline-secondary btn-sm" onClick={copyUrl}>
                    {copied ? '✅ Copiado' : '📋 Copiar'}
                  </button>
                </div>
                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-primary fw-bold" onClick={openCatalog}>
                    🔗 Abrir catálogo
                  </button>
                  <button className="btn btn-outline-secondary" onClick={() => window.print()}>
                    🖨️ Imprimir QR
                  </button>
                </div>
              </div>
            </div>

            {/* Instrucciones */}
            <div className="card border-0 shadow-sm mt-3">
              <div className="card-body">
                <h6 className="fw-bold mb-3">📋 ¿Cómo funciona?</h6>
                <div className="d-flex gap-3 mb-3">
                  <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                    style={{width:32,height:32,background:'#1e3a5f',fontSize:14}}>1</div>
                  <div>
                    <div className="fw-semibold" style={{fontSize:13}}>Imprime o muestra el QR</div>
                    <div className="text-muted" style={{fontSize:12}}>Ponlo en la entrada o en la caja</div>
                  </div>
                </div>
                <div className="d-flex gap-3 mb-3">
                  <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                    style={{width:32,height:32,background:'#1e3a5f',fontSize:14}}>2</div>
                  <div>
                    <div className="fw-semibold" style={{fontSize:13}}>El cliente escanea con su celular</div>
                    <div className="text-muted" style={{fontSize:12}}>Ve todos los productos con precios</div>
                  </div>
                </div>
                <div className="d-flex gap-3 mb-3">
                  <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                    style={{width:32,height:32,background:'#1e3a5f',fontSize:14}}>3</div>
                  <div>
                    <div className="fw-semibold" style={{fontSize:13}}>Arma su pedido</div>
                    <div className="text-muted" style={{fontSize:12}}>Selecciona productos y cantidades</div>
                  </div>
                </div>
                <div className="d-flex gap-3">
                  <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                    style={{width:32,height:32,background:'#25d366',fontSize:14}}>4</div>
                  <div>
                    <div className="fw-semibold" style={{fontSize:13}}>Envía por WhatsApp</div>
                    <div className="text-muted" style={{fontSize:12}}>El pedido llega directo a tu WhatsApp</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vista previa y estadísticas */}
          <div className="col-md-7">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="fw-bold mb-0">📊 Estadísticas del catálogo</h6>
                </div>
                <div className="row g-3 mt-1">
                  {[
                    ['🛒 Productos activos', products.length, 'primary'],
                    ['📦 Con stock', products.filter(p=>p.stock>0).length, 'success'],
                    ['⚠️ Sin stock', products.filter(p=>p.stock<=0).length, 'warning'],
                    ['🏷️ Categorías', new Set(products.map(p=>p.category).filter(Boolean)).size, 'info'],
                  ].map(([label, val, color])=>(
                    <div key={label} className="col-6">
                      <div className={`card border-${color} border-1 text-center py-2`}>
                        <div className={`fw-bold fs-5 text-${color}`}>{val}</div>
                        <div className="text-muted small">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Config IP */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body">
                <h6 className="fw-bold mb-2">⚙️ Configuración de red</h6>
                <p className="text-muted small mb-2">
                  Para que los clientes accedan desde sus celulares, deben estar en la misma WiFi del negocio.
                  Ingresa la IP del computador donde está instalado SmartMerca:
                </p>
                <div className="input-group input-group-sm">
                  <span className="input-group-text">http://</span>
                  <input type="text" className="form-control" value={ip}
                    onChange={e=>setIp(e.target.value)} placeholder="192.168.1.100" />
                  <span className="input-group-text">:3000/catalogo.html</span>
                </div>
                <div className="text-muted mt-2" style={{fontSize:11}}>
                  💡 Para encontrar tu IP: en Windows abre CMD y escribe <code>ipconfig</code> — busca "IPv4" en tu adaptador WiFi
                </div>
              </div>
            </div>

            {/* Lista de productos */}
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-2 small" style={{background:'#f8fafc'}}>
                📋 Productos en el catálogo ({products.filter(p=>p.stock>0).length} disponibles)
              </div>
              <div style={{maxHeight:280, overflowY:'auto'}}>
                <table className="table table-sm mb-0" style={{fontSize:12}}>
                  <thead className="table-light sticky-top">
                    <tr><th>Producto</th><th>Categoría</th><th className="text-end">Precio</th><th className="text-center">Stock</th></tr>
                  </thead>
                  <tbody>
                    {products.slice(0,50).map(p=>(
                      <tr key={p.id} style={{opacity: p.stock<=0?0.5:1}}>
                        <td className="fw-semibold">{p.name}</td>
                        <td className="text-muted">{p.category||'—'}</td>
                        <td className="text-end text-success fw-bold">
                          ${Number(p.price).toLocaleString('es-CO')}
                        </td>
                        <td className="text-center">
                          {p.stock <= 0
                            ? <span className="badge bg-danger">Sin stock</span>
                            : <span className="badge bg-success">{p.stock}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Catalogo;