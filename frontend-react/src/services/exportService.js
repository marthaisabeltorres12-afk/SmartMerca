import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmtMoney = (n) => `$${Number(n||0).toLocaleString('es-CO')}`;
const fmtDate  = (d) => d?.slice(0,10) || '';
const NOW      = () => new Date().toLocaleDateString('es-CO');

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-CO') : '';

const formatDateFile = (d) =>
  d ? new Date(d).toLocaleDateString('es-CO').replace(/\//g,'-') : '';

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
    foot: [[' ',' ',' ',' ','TOTAL', fmtMoney(sales.reduce((a,s)=>a+s.total*1.19,0))]],
    headStyles:  { fillColor: [26,107,60] },
    footStyles:  { fillColor: [240,240,240], fontStyle:'bold' },
    alternateRowStyles: { fillColor: [248,250,252] },
  });
  const nombre = dateFrom && dateTo
    ? `ventas_${formatDateFile(dateFrom)}_al_${formatDateFile(dateTo)}`
    : `ventas_${NOW().replace(/\//g,'-')}`;
  doc.save(`${nombre}.pdf`);
};

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

export const exportInventarioPDF = (products) => {
  const doc = new jsPDF();
  pdfHeader(doc, 'Reporte de Inventario');
  autoTable(doc, {
    startY: 28,
    head: [['Producto','Categoría','Stock','Precio venta','Vencimiento','Estado']],
    body: products.map(p => [
      p.name, p.category || '—', p.stock, fmtMoney(p.price),
      p.expiry_date || '—', p.is_active ? 'Activo' : 'Inactivo',
    ]),
    headStyles: { fillColor: [26,107,60] },
    alternateRowStyles: { fillColor: [248,250,252] },
  });
  doc.save(`inventario_${NOW().replace(/\//g,'-')}.pdf`);
};

export const exportInventarioExcel = (products) => {
  const data = products.map(p => ({
    'Producto': p.name, 'Categoría': p.category || '—', 'Stock': p.stock,
    'Precio venta': p.price, 'Vencimiento': p.expiry_date || '—',
    'Proveedor': p.supplier || '—', 'Estado': p.is_active ? 'Activo' : 'Inactivo',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  XLSX.writeFile(wb, `inventario_${NOW().replace(/\//g,'-')}.xlsx`);
};

export const exportCierresPDF    = (closes)    => { console.log("Exportando cierres PDF", closes); };
export const exportCierresExcel  = (closes)    => { console.log("Exportando cierres Excel", closes); };
export const exportClientesPDF   = (customers) => { console.log("Exportando clientes PDF", customers); };
export const exportClientesExcel = (customers) => { console.log("Exportando clientes Excel", customers); };

export const exportOrdenCompraPDF = (order) => {
  const doc = new jsPDF();
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('SmartMerca', 14, 12);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('ORDEN DE COMPRA', 14, 20);
  doc.text(`Generado: ${NOW()}`, 196, 20, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(`Orden: ${order.numero_orden}`, 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proveedor: ${order.supplier_name || '—'}`, 14, 46);
  doc.text(`Fecha esperada: ${order.fecha_esperada || '—'}`, 14, 54);
  doc.text(`Estado: ${order.status?.toUpperCase()}`, 14, 62);
  if (order.notas) doc.text(`Notas: ${order.notas}`, 14, 70);
  autoTable(doc, {
    startY: order.notas ? 78 : 70,
    head: [['Producto','Cant. solicitada','Recibido','Pendiente','Precio','Subtotal']],
    body: (order.items || []).map(i => [
      i.product_name || '—', i.cantidad_solicitada, i.cantidad_recibida || 0,
      i.pendiente ?? (i.cantidad_solicitada - (i.cantidad_recibida||0)),
      i.precio_costo_acordado ? fmtMoney(i.precio_costo_acordado) : '—',
      i.precio_costo_acordado ? fmtMoney(i.precio_costo_acordado * i.cantidad_solicitada) : '—',
    ]),
    foot: [['TOTAL ESTIMADO','','','','', fmtMoney((order.items||[]).reduce((a,i) => a + (parseFloat(i.precio_costo_acordado||0) * parseFloat(i.cantidad_solicitada||0)), 0))]],
    headStyles: { fillColor: [30, 58, 95] },
    footStyles: { fillColor: [240, 249, 255], fontStyle: 'bold' },
    styles: { fontSize: 10 },
  });
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
    doc.text('SmartMerca — Documento interno', 14, 290);
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' });
  }
  doc.save(`orden_compra_${order.numero_orden}.pdf`);
};

// ── Exportar vista como PDF (para dashboards de roles) ──────────────────────
export const exportViewPDF = async (elementId, fileName = 'reporte') => {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const el = document.getElementById(elementId);
    if (!el) { console.error('Elemento no encontrado:', elementId); return; }

    const canvas = await html2canvas(el, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfW    = pdf.internal.pageSize.getWidth();
    const pdfH    = pdf.internal.pageSize.getHeight();
    const imgH    = (canvas.height * pdfW) / canvas.width;

    let posY = 0;
    while (posY < imgH) {
      if (posY > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -posY, pdfW, imgH);
      posY += pdfH;
    }

    pdf.save(`${fileName}-${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (e) {
    console.error('Error generando PDF:', e);
  }
};

// ── Exportaciones para roles (Supervisor, Contador, Auditor) ────────────────

export const exportSupervisorPDF = (ventas, shifts, dateFrom, dateTo) => {
  const doc = new jsPDF();
  pdfHeader(doc, `Reporte Supervisor — ${dateFrom || 'Todos'} al ${dateTo || 'hoy'}`);
  let y = 28;

  // Ventas
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Ventas del período', 14, y + 6); y += 10;
  autoTable(doc, {
    startY: y,
    head: [['#Venta','Fecha','Cajero','Cliente','Método','Total']],
    body: ventas.map(s => [
      `#${String(s.id).padStart(6,'0')}`,
      fmtDate(s.created_at),
      s.cashier || '—',
      s.customer?.full_name || 'Consumidor Final',
      s.payment_method || 'efectivo',
      fmtMoney(s.total),
    ]),
    foot: [[' ',' ',' ',' ','TOTAL', fmtMoney(ventas.reduce((a,s)=>a+Number(s.total||0),0))]],
    headStyles:  { fillColor: [26,107,60] },
    footStyles:  { fillColor: [240,240,240], fontStyle:'bold' },
    alternateRowStyles: { fillColor: [248,250,252] },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Turnos
  if (shifts && shifts.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text('Turnos de caja', 14, y + 4); y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Cajero','Apertura','Cierre','Base','Ventas','Contó','Diferencia','Estado']],
      body: shifts.map(s => [
        s.cashier || '—',
        fmtDate(s.opened_at),
        s.closed_at ? fmtDate(s.closed_at) : 'Abierto',
        fmtMoney(s.base_amount),
        fmtMoney(s.total_sales),
        s.cash_counted != null ? fmtMoney(s.cash_counted) : '—',
        s.difference != null ? fmtMoney(s.difference) : '—',
        s.status || '—',
      ]),
      headStyles: { fillColor: [26,107,60] },
      alternateRowStyles: { fillColor: [248,250,252] },
    });
  }

  const nombre = `supervisor_${formatDateFile(dateFrom)}_al_${formatDateFile(dateTo) || NOW().replace(/\//g,'-')}`;
  doc.save(`${nombre}.pdf`);
};

export const exportSupervisorExcel = (ventas, shifts, dateFrom, dateTo) => {
  const wb = XLSX.utils.book_new();

  // Hoja ventas
  const dataVentas = ventas.map(s => ({
    'Venta':        `#${String(s.id).padStart(6,'0')}`,
    'Fecha':        fmtDate(s.created_at),
    'Cajero':       s.cashier || '—',
    'Cliente':      s.customer?.full_name || 'Consumidor Final',
    'Método pago':  s.payment_method || 'efectivo',
    'Total':        Number(s.total || 0),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataVentas), 'Ventas');

  // Hoja turnos
  if (shifts && shifts.length > 0) {
    const dataTurnos = shifts.map(s => ({
      'Cajero':     s.cashier || '—',
      'Apertura':   fmtDate(s.opened_at),
      'Cierre':     s.closed_at ? fmtDate(s.closed_at) : 'Abierto',
      'Base':       Number(s.base_amount || 0),
      'Ventas':     Number(s.total_sales || 0),
      'Contó':      s.cash_counted != null ? Number(s.cash_counted) : '',
      'Diferencia': s.difference != null ? Number(s.difference) : '',
      'Estado':     s.status || '—',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataTurnos), 'Turnos');
  }

  XLSX.writeFile(wb, `supervisor_${formatDateFile(dateFrom) || NOW().replace(/\//g,'-')}.xlsx`);
};

export const exportContadorPDF = (ventas, facturas, dateFrom, dateTo) => {
  const doc = new jsPDF();
  pdfHeader(doc, `Reporte Financiero — ${dateFrom || 'Todos'} al ${dateTo || 'hoy'}`);
  let y = 28;

  // KPIs financieros
  const totalVentas = ventas.reduce((a,s) => a+Number(s.total||0), 0);
  const totalPagar  = facturas.filter(f => f.balance_pendiente > 0).reduce((a,f) => a+Number(f.balance_pendiente||0), 0);
  doc.setFontSize(10);
  doc.text(`Total ingresos: ${fmtMoney(totalVentas)}`, 14, y+6);
  doc.text(`Cuentas por pagar: ${fmtMoney(totalPagar)}`, 80, y+6);
  doc.text(`Transacciones: ${ventas.length}`, 150, y+6);
  y += 14;

  // Ventas
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text('Ventas del período', 14, y+4); y += 8;
  autoTable(doc, {
    startY: y,
    head: [['#','Fecha','Cajero','Cliente','Método','Total']],
    body: ventas.map(s => [
      `#${String(s.id).padStart(6,'0')}`,
      fmtDate(s.created_at),
      s.cashier || '—',
      s.customer?.full_name || 'Consumidor Final',
      s.payment_method || 'efectivo',
      fmtMoney(s.total),
    ]),
    foot: [[' ',' ',' ',' ','TOTAL INGRESOS', fmtMoney(totalVentas)]],
    headStyles:  { fillColor: [26,107,60] },
    footStyles:  { fillColor: [240,240,240], fontStyle:'bold' },
    alternateRowStyles: { fillColor: [248,250,252] },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Cuentas por pagar
  if (facturas.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text('Cuentas por pagar', 14, y+4); y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Proveedor','Factura','Total','Pagado','Pendiente','Estado']],
      body: facturas.map(f => [
        f.supplier_name || '—',
        f.numero_factura || '—',
        fmtMoney(f.total),
        fmtMoney(f.total_pagado || 0),
        fmtMoney(f.balance_pendiente || 0),
        f.estado || '—',
      ]),
      headStyles: { fillColor: [26,107,60] },
      alternateRowStyles: { fillColor: [248,250,252] },
    });
  }

  doc.save(`contador_financiero_${formatDateFile(dateFrom) || NOW().replace(/\//g,'-')}.pdf`);
};

export const exportContadorExcel = (ventas, facturas, dateFrom, dateTo) => {
  const wb = XLSX.utils.book_new();

  const dataVentas = ventas.map(s => ({
    'Venta':       `#${String(s.id).padStart(6,'0')}`,
    'Fecha':       fmtDate(s.created_at),
    'Cajero':      s.cashier || '—',
    'Cliente':     s.customer?.full_name || 'Consumidor Final',
    'Método pago': s.payment_method || 'efectivo',
    'Total':       Number(s.total || 0),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataVentas), 'Ventas');

  if (facturas.length > 0) {
    const dataFacturas = facturas.map(f => ({
      'Proveedor':  f.supplier_name || '—',
      'Factura':    f.numero_factura || '—',
      'Total':      Number(f.total || 0),
      'Pagado':     Number(f.total_pagado || 0),
      'Pendiente':  Number(f.balance_pendiente || 0),
      'Estado':     f.estado || '—',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataFacturas), 'Cuentas por pagar');
  }

  XLSX.writeFile(wb, `contador_financiero_${formatDateFile(dateFrom) || NOW().replace(/\//g,'-')}.xlsx`);
};

export const exportAuditorPDF = (logs, dateFrom, dateTo) => {
  const doc = new jsPDF();
  pdfHeader(doc, `Bitácora de Auditoría — ${dateFrom || 'Todos'} al ${dateTo || 'hoy'}`);
  autoTable(doc, {
    startY: 28,
    head: [['Fecha','Usuario','Rol','Acción','Descripción']],
    body: logs.map(l => [
      l.fecha_hora?.slice(0,16).replace('T',' ') || '—',
      l.user_name  || '—',
      l.user_role  || '—',
      l.accion     || '—',
      (l.descripcion || '—').slice(0, 60),
    ]),
    headStyles: { fillColor: [30,58,95] },
    alternateRowStyles: { fillColor: [248,250,252] },
    styles: { fontSize: 9 },
    columnStyles: { 4: { cellWidth: 70 } },
  });
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
    doc.text('SmartMerca — Documento confidencial de auditoría', 14, 290);
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align:'right' });
  }
  doc.save(`auditoria_${formatDateFile(dateFrom) || NOW().replace(/\//g,'-')}.pdf`);
};

export const exportAuditorExcel = (logs, dateFrom, dateTo) => {
  const data = logs.map(l => ({
    'Fecha y hora': l.fecha_hora?.slice(0,16).replace('T',' ') || '—',
    'Usuario':      l.user_name  || '—',
    'Rol':          l.user_role  || '—',
    'Acción':       l.accion     || '—',
    'Descripción':  l.descripcion || '—',
    'IP':           l.ip         || '—',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bitácora');
  XLSX.writeFile(wb, `auditoria_${formatDateFile(dateFrom) || NOW().replace(/\//g,'-')}.xlsx`);
};