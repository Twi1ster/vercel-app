import React, { useState } from 'react';

const HEADERS = [
  'Invoice ID', 'İCAZƏ', 'EQ №', 'EQ Tarixi', 'Reklam Yayıcısı', 'VÖEN',
  'Original Amount', 'Paid Amount', 'Remaining Amount',
  'Payment Status', 'Payment Date',
];

const COL_WIDTHS = [26, 18, 22, 14, 30, 15, 16, 16, 18, 16, 14];

const SUMMARY_HEADERS = [
  'İCAZƏ', 'Reklam Yayıcısı', 'VÖEN',
  'Total Invoice Amount', 'Total Paid', 'Remaining Balance', 'Overpayment',
];
const SUMMARY_WIDTHS = [18, 30, 15, 22, 16, 20, 16];

const STATUS_COLOR = {
  PAID:        'FFD9EAD3',
  PARTIAL:     'FFFFF2CC',
  UNPAID:      'FFF4CCCC',
  OVERPAYMENT: 'FFFCE5CD',
};

export default function Reconciliation({ api }) {
  const [loading, setLoading] = useState(false);

  const exportExcel = async () => {
    setLoading(true);
    try {
      const [{ default: ExcelJS }, res] = await Promise.all([
        import('exceljs'),
        fetch(`${api}/api/reconciliation`),
      ]);
      const { rows, summary } = await res.json();

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Allocation');

      const headerRow = ws.addRow(HEADERS);
      headerRow.height = 32;
      headerRow.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border    = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
      });
      ws.columns.forEach((col, i) => { col.width = COL_WIDTHS[i] || 14; });

      rows.forEach(row => {
        const r = ws.addRow([
          row.invoiceId,
          row.icazeNo,
          row.eqNomresi,
          row.eqTarixi,
          row.reklamYayicisi,
          row.voen,
          row.originalAmount || '',
          row.paidAmount || '',
          row.remainingAmount || '',
          row.status,
          row.paymentDate,
        ]);
        const color = STATUS_COLOR[row.status];
        if (color) {
          r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            if (row.status === 'OVERPAYMENT') cell.font = { italic: true, bold: true, size: 10 };
          });
        }
      });

      // Summary sheet
      const sws = wb.addWorksheet('Summary');
      const sHeaderRow = sws.addRow(SUMMARY_HEADERS);
      sHeaderRow.height = 32;
      sHeaderRow.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      sws.columns.forEach((col, i) => { col.width = SUMMARY_WIDTHS[i] || 14; });
      summary.forEach(s => {
        const r = sws.addRow([
          s.icazeNo, s.reklamYayicisi, s.voen,
          s.totalInvoiceAmount, s.totalPaid, s.remainingBalance, s.overpayment,
        ]);
        if (s.overpayment > 0) {
          r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } };
          });
        }
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `allocation_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
    } catch (e) { console.error(e); alert('Export xətası: ' + e.message); }
    setLoading(false);
  };

  return (
    <div>
      <div className="module-header">
        <div className="module-title"><span>03</span> — Rekonsiliasiya · Allokasiya</div>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={exportExcel} disabled={loading}>
            {loading ? 'Hazırlanır...' : '⬇ Excel Export'}
          </button>
        </div>
      </div>
      <div className="empty-state" style={{ marginTop: 80 }}>
        <div className="es-icon">📊</div>
        <p>Bank medaxilləri <b>Müraciət № / EQF №</b> ilə İCAZƏ üzrə qaimələrə FIFO allokasiya olunur.</p>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
          🟢 PAID &nbsp;·&nbsp; 🟡 PARTIAL &nbsp;·&nbsp; 🔴 UNPAID &nbsp;·&nbsp; 🟠 OVERPAYMENT
        </p>
      </div>
    </div>
  );
}
