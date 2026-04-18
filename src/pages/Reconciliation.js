import React, { useState } from 'react';

export default function Reconciliation({ api }) {
  const [loading, setLoading] = useState(false);

  const exportExcel = async () => {
    setLoading(true);
    try {
      const [XLSX, res] = await Promise.all([
        import('xlsx'),
        fetch(`${api}/api/reconciliation?limit=100000`),
      ]);
      const json = await res.json();
      const data = json.data || [];

      const rows = data.flatMap(row => {
        const main = {
          'VÖEN': row.voen,
          'Reklam Yayıcısı': row.reklamYayicisi,
          'İcazə №': row.icazeNo,
          'EQ Nömrəsi': row.eqNomresi,
          'EQ Tarixi': row.eqTarixi,
          'EQ Əsas': row.eqMeblegEsas,
          'EQ ƏDV': row.eqMeblegEdv,
          'EQ CƏMİ': row.eqTotal,
          'Ödənilmiş (Əsas)': row.paidEsas,
          'Ödənilmiş (ƏDV)': row.paidEdv,
          'Ödənilmiş CƏMİ': row.paidTotal,
          'Qalıq': row.qaliq,
          'Status': row.status,
        };
        if (row.artiqOdenis > 0) {
          return [main, {
            'VÖEN': '',
            'Reklam Yayıcısı': '↳ Artıq ödəniş',
            'İcazə №': '',
            'EQ Nömrəsi': '',
            'EQ Tarixi': row.artiqOdenisTarixi,
            'EQ Əsas': '', 'EQ ƏDV': '', 'EQ CƏMİ': '',
            'Ödənilmiş (Əsas)': '', 'Ödənilmiş (ƏDV)': '', 'Ödənilmiş CƏMİ': '',
            'Qalıq': row.artiqOdenis,
            'Status': 'Artıq Ödəniş',
          }];
        }
        return [main];
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rekonsiliasiya');
      XLSX.writeFile(wb, `rekonsiliasiya_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { alert('Export xətası'); }
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
        <p>Bütün EQ ödəniş statuslarını Excel kimi yükləmək üçün yuxarıdakı düyməni basın.</p>
      </div>
    </div>
  );
}
