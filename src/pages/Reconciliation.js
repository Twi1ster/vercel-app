import React, { useState } from 'react';

export default function Reconciliation({ api }) {
  const [loading, setLoading] = useState(false);

  const exportExcel = async () => {
    setLoading(true);
    try {
      const [{ default: ExcelJS }, res] = await Promise.all([
        import('exceljs'),
        fetch(`${api}/api/reconciliation?limit=100000`),
      ]);
      const json = await res.json();
      const data = json.data || [];

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Rekonsiliasiya');

      const HEADERS = [
        'VÖEN', 'Reklam Yayıcısı', 'İcazə №', 'EQ Nömrəsi', 'EQ Tarixi',
        'EQ Əsas (Yayım haqqı yığımı)', 'EQ ƏDV (ƏDV daxilolma)', 'EQ CƏMİ',
        'Ödənilmiş (Əsas)', 'Ödəniş Tarixi (Əsas)', 'Qeyd (Əsas)',
        'Ödənilmiş (ƏDV)', 'Ödəniş Tarixi (ƏDV)', 'Qeyd (ƏDV)',
        'Ödənilmiş CƏMİ', 'Qalıq (Əsas)', 'Qalıq (ƏDV)', 'Status', 'Mənbə',
      ];

      // Header row
      const headerRow = ws.addRow(HEADERS);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      headerRow.height = 40;

      const GREEN  = 'FFD9EAD3';
      const YELLOW = 'FFFFF2CC';

      data.forEach(row => {
        const hasMatch = row.bankCount > 0;

        const mainValues = [
          row.voen, row.reklamYayicisi, row.icazeNo, row.eqNomresi, row.eqTarixi,
          row.eqEsas, row.eqEdv, row.eqTotal,
          row.paidEsas > 0 ? row.paidEsas : '',
          row.paidEsas > 0 ? row.esasTarix : '',
          row.paidEsas > 0 ? row.esasQeyd  : '',
          row.paidEdv  > 0 ? row.paidEdv   : '',
          row.paidEdv  > 0 ? row.edvTarix  : '',
          row.paidEdv  > 0 ? row.edvQeyd   : '',
          row.paidTotal > 0 ? row.paidTotal : '',
          row.qaliqEsas, row.qaliqEdv,
          row.status,
          hasMatch ? 'AI generated' : '',
        ];

        const mainRow = ws.addRow(mainValues);
        if (hasMatch) {
          mainRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
          });
        }

        if (row.artiqEsas > 0.01) {
          const artiqRow = ws.addRow([
            '', '↳ Artıq ödəniş — Əsas hesab (Yayım haqqı yığımı)', '', '', '',
            '', '', '',
            row.paidEsas, row.esasTarix, row.esasQeyd,
            '', '', '',
            '', -row.artiqEsas, '',
            'Artıq Ödəniş (Əsas)', 'AI generated',
          ]);
          artiqRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
            cell.font = { italic: true };
          });
        }

        if (row.artiqEdv > 0.01) {
          const artiqRow = ws.addRow([
            '', '↳ Artıq ödəniş — ƏDV hesab (ƏDV daxilolma)', '', '', '',
            '', '', '',
            '', '', '',
            row.paidEdv, row.edvTarix, row.edvQeyd,
            '', '', -row.artiqEdv,
            'Artıq Ödəniş (ƏDV)', 'AI generated',
          ]);
          artiqRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
            cell.font = { italic: true };
          });
        }
      });

      // Column widths
      ws.columns.forEach((col, i) => {
        col.width = [15, 35, 20, 20, 14, 18, 18, 14, 16, 16, 16, 14, 14, 14, 16, 14, 14, 20, 14][i] || 14;
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekonsiliasiya_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert('Export xətası'); }
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
        <p>Yalnız ödəniş tarixi olmayan EQ qeydləri götürülür, bank ilə uyğunlaşdırılır və Excel kimi yüklənir.</p>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
          🟢 Yaşıl — bank ilə uyğunlaşdırılan qeydlər &nbsp;·&nbsp; 🟡 Sarı — artıq ödəniş sətirləri
        </p>
      </div>
    </div>
  );
}
