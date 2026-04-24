import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmtMoney = (n) => `$${Number(n||0).toLocaleString('es-CO')}`;
const fmtDate  = (d) => d?.slice(0,10) || '';
const NOW      = () => new Date().toLocaleDateString('es-CO');

// 🔥 Formatear fechas bonitas
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-CO') : '';

const formatDateFile = (d) =>
  d ? new Date(d).toLocaleDateString('es-CO').replace(/\//g,'-') : '';

// ── Helpers PDF ────────────────────────────────────────
const pdfHeader = (doc, title) => {
  doc.setFillColor(26, 107, 60);
  doc.rect(0, 0, 210, 22, 'F');

  doc.setTextColor(255,255,255);
  doc.setFontSize(14);
  doc.setFont('helvetica','bold');
  doc.text('SmartMerca', 14, 10);

  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text(title, 14, 17);

  doc.text(`Generado: ${NOW()}`, 196, 17, { align:'right' });

  doc.setTextColor(0,0,0);
};

// ── VENTAS PDF ─────────────────────────────────────────
export const exportVentasPDF = (sales, dateFrom, dateTo) => {
  const doc = new jsPDF();

  const titulo = dateFrom && dateTo
    ? `Reporte de ventas del ${formatDate(dateFrom)} al ${formatDate(dateTo)}`
    : 'Reporte de Ventas';

  pdfHeader(doc, titulo);

  autoTable(doc, {
    startY: 28,
    head: [['#Venta','Fecha','Cajero','Cliente','Método','Total']],
    body: sales.map(s => [
      `#${String(s.id).padStart(6,'0')}`,
      fmtDate(s.created_at),
      s.cashier || s.cashier_name || '—',
      s.customer?.full_name || '—',
      s.payment_method || 'efectivo',
      fmtMoney(s.total * 1.19),
    ]),
    foot: [[
      ' ',' ',' ',' ','TOTAL',
      fmtMoney(sales.reduce((a,s)=>a+s.total*1.19,0))
    ]],
    headStyles:  { fillColor: [26,107,60] },
    footStyles:  { fillColor: [240,240,240], fontStyle:'bold' },
    alternateRowStyles: { fillColor: [248,250,252] },
  });

  const nombre = dateFrom && dateTo
    ? `ventas_${formatDateFile(dateFrom)}_al_${formatDateFile(dateTo)}`
    : `ventas_${NOW().replace(/\//g,'-')}`;

  doc.save(`${nombre}.pdf`);
};

// ── VENTAS EXCEL ───────────────────────────────────────
export const exportVentasExcel = (sales, dateFrom, dateTo) => {
  const data = sales.map(s => ({
    'Venta':         `#${String(s.id).padStart(6,'0')}`,
    'Fecha':         fmtDate(s.created_at),
    'Cajero':        s.cashier || s.cashier_name || '—',
    'Cliente':       s.customer?.full_name || '—',
    'Método pago':   s.payment_method || 'efectivo',
    'Subtotal':      s.total,
    'IVA 19%':       s.total * 0.19,
    'Total':         s.total * 1.19,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, 'Ventas');

  const nombre = dateFrom && dateTo
    ? `ventas_${formatDateFile(dateFrom)}_al_${formatDateFile(dateTo)}`
    : `ventas_${NOW().replace(/\//g,'-')}`;

  XLSX.writeFile(wb, `${nombre}.xlsx`);
};

// ── INVENTARIO PDF ─────────────────────────────────────
export const exportInventarioPDF = (products) => {
  const doc = new jsPDF();
  pdfHeader(doc, 'Reporte de Inventario');

  autoTable(doc, {
    startY: 28,
    head: [['Producto','Categoría','Stock','Precio venta','Vencimiento','Estado']],
    body: products.map(p => [
      p.name,
      p.category || '—',
      p.stock,
      fmtMoney(p.price),
      p.expiry_date || '—',
      p.is_active ? 'Activo' : 'Inactivo',
    ]),
    headStyles: { fillColor: [26,107,60] },
    alternateRowStyles: { fillColor: [248,250,252] },
  });

  doc.save(`inventario_${NOW().replace(/\//g,'-')}.pdf`);
};

// ── INVENTARIO EXCEL ───────────────────────────────────
export const exportInventarioExcel = (products) => {
  const data = products.map(p => ({
    'Producto':      p.name,
    'Categoría':     p.category || '—',
    'Stock':         p.stock,
    'Precio venta':  p.price,
    'Vencimiento':   p.expiry_date || '—',
    'Proveedor':     p.supplier || '—',
    'Estado':        p.is_active ? 'Activo' : 'Inactivo',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

  XLSX.writeFile(wb, `inventario_${NOW().replace(/\//g,'-')}.xlsx`);
};
// ── CIERRES ─────────────────────────
export const exportCierresPDF = (closes) => {
  console.log("Exportando cierres PDF", closes);
};

export const exportCierresExcel = (closes) => {
  console.log("Exportando cierres Excel", closes);
};

// ── CLIENTES ────────────────────────
export const exportClientesPDF = (customers) => {
  console.log("Exportando clientes PDF", customers);
};

export const exportClientesExcel = (customers) => {
  console.log("Exportando clientes Excel", customers);
};
// ── ORDEN DE COMPRA PDF ─────────────────────────────────
export const exportOrdenCompraPDF = (order) => {
  const doc = new jsPDF();

  // Encabezado
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SmartMerca', 14, 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('ORDEN DE COMPRA', 14, 20);
  doc.text(`Generado: ${NOW()}`, 196, 20, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Datos de la orden
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Orden: ${order.numero_orden}`, 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proveedor: ${order.supplier_name || '—'}`, 14, 46);
  doc.text(`Fecha esperada: ${order.fecha_esperada || '—'}`, 14, 54);
  doc.text(`Estado: ${order.status?.toUpperCase()}`, 14, 62);
  if (order.notas) {
    doc.text(`Notas: ${order.notas}`, 14, 70);
  }

  // Tabla de productos
  autoTable(doc, {
    startY: order.notas ? 78 : 70,
    head: [['Producto', 'Cantidad solicitada', 'Recibido', 'Pendiente', 'Precio acordado', 'Subtotal']],
    body: (order.items || []).map(i => [
      i.product_name || '—',
      i.cantidad_solicitada,
      i.cantidad_recibida || 0,
      i.pendiente ?? (i.cantidad_solicitada - (i.cantidad_recibida||0)),
      i.precio_costo_acordado ? fmtMoney(i.precio_costo_acordado) : '—',
      i.precio_costo_acordado ? fmtMoney(i.precio_costo_acordado * i.cantidad_solicitada) : '—',
    ]),
    foot: [[
      'TOTAL ESTIMADO', '', '', '', '',
      fmtMoney((order.items||[]).reduce((a,i) =>
        a + (parseFloat(i.precio_costo_acordado||0) * parseFloat(i.cantidad_solicitada||0)), 0))
    ]],
    headStyles:  { fillColor: [30, 58, 95] },
    footStyles:  { fillColor: [240, 249, 255], fontStyle: 'bold' },
    styles:      { fontSize: 10 },
  });

  // Pie de página
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('SmartMerca — Documento interno', 14, 290);
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' });
  }

  doc.save(`orden_compra_${order.numero_orden}.pdf`);
};