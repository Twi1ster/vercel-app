import React, { useState } from 'react';

const HEADERS = [
  'Reklam yayıcısının adı', 'VÖEN', 'İcazə',
  'Elektron qaimənin tarixi', 'Elektron qaimənin nömrəsi',
  'EQ məbləği(əsas)', 'EQ məbləği(ƏDV)',
  'Ödəniş tarixi', 'Ödəniş məbləği(Əsas)',
  'Ödəniş tarixi(ƏDV)', 'Ödəniş məbləği(ƏDV)',
  'Qeyd',
];

const COL_WIDTHS = [35, 15, 20, 16, 22, 18, 16, 14, 18, 14, 18, 16];

export default function Reconciliation({ api }) {
  const [loading, setLoading] = useState(false);

  const exportExcel = async () => {
    setLoading(true);
    try {
      const [{ default: ExcelJS }, res] = await Promise.all([
        import('exceljs'),
        fetch(`${api}/api/reconciliation`),
      ]);
      const data = await res.json();

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Rekonsiliasiya');

      // Header
      const headerRow = ws.addRow(HEADERS);
      headerRow.height = 36;
      headerRow.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border    = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
      });

      ws.columns.forEach((col, i) => { col.width = COL_WIDTHS[i] || 14; });

      data.forEach(row => {
        // Ana sətir
        const mainRow = ws.addRow([
          row.reklamYayicisi,
          row.voen,
          row.icazeNo,
          row.eqTarixi,
          row.eqNomresi,
          row.eqEsas,
          row.eqEdv,
          row.paidEsas > 0 ? row.esasTarix : '',
          row.paidEsas > 0 ? row.paidEsas  : '',
          row.paidEdv  > 0 ? row.edvTarix  : '',
          row.paidEdv  > 0 ? row.paidEdv   : '',
          row.paidEsas > 0 ? row.esasQeyd  : (row.paidEdv > 0 ? row.edvQeyd : ''),
        ]);

        if (row.hasMatch) {
          mainRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
          });
        }

        // Artıq ödəniş — tək sətir
        if (row.artiq > 0.01) {
          const r = ws.addRow([
            '↳ Artıq ödəniş', '', row.icazeNo, '', '',
            '', '', row.artiqTarix, row.artiq, '', '', '',
          ]);
          r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            cell.font = { italic: true, size: 10 };
          });
        }
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rekonsiliasiya_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
    } catch (e) { console.error(e); alert('Export xətası: ' + e.message); }
    setLoading(false);
  };

  return (
    <div>
      <div className="module-header">
        <div className="module-title"><span>03</span> — Rekonsiliasiya · EQ Ödəniş Statusu</div>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={exportExcel} disabled={loading}>
            {loading ? 'Hazırlanır...' : '⬇ Excel Export'}
          </button>
        </div>
      </div>
      <div className="empty-state" style={{ marginTop: 80 }}>
        <div className="es-icon">📊</div>
        <p>Ödəniş tarixi olmayan EQ qeydləri bank ilə uyğunlaşdırılır və Excel kimi yüklənir.</p>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
          🟢 Yaşıl — bank ilə uyğunlaşdırılan &nbsp;·&nbsp; 🟡 Sarı — artıq ödəniş
        </p>
      </div>
    </div>
  );
}
