import React from 'react';

const ExportButtons = ({ onPDF, onExcel, disabled }) => (
  <div className="d-flex gap-2">
    <button className="btn btn-outline-danger btn-sm" onClick={onPDF} disabled={disabled}>
      📄 PDF
    </button>
    <button className="btn btn-outline-success btn-sm" onClick={onExcel} disabled={disabled}>
      📊 Excel
    </button>
  </div>
);

export default ExportButtons;