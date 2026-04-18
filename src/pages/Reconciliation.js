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

      const empty = { 'VÖEN':'','Reklam Yayıcısı':'','İcazə №':'','EQ Nömrəsi':'','EQ Tarixi':'','EQ Əsas (Yayım haqqı yığımı)':'','EQ ƏDV (ƏDV daxilolma)':'','EQ CƏMİ':'','Ödənilmiş (Əsas)':'','Ödəniş Tarixi (Əsas)':'','Ödənilmiş (ƏDV)':'','Ödəniş Tarixi (ƏDV)':'','Ödənilmiş CƏMİ':'','Qalıq (Əsas)':'','Qalıq (ƏDV)':'','Status':'' };
      const rows = data.flatMap(row => {
        const main = {
          'VÖEN': row.voen,
          'Reklam Yayıcısı': row.reklamYayicisi,
          'İcazə №': row.icazeNo,
          'EQ Nömrəsi': row.eqNomresi,
          'EQ Tarixi': row.eqTarixi,
          'EQ Əsas (Yayım haqqı yığımı)': row.eqMeblegEsas,
          'EQ ƏDV (ƏDV daxilolma)': row.eqMeblegEdv,
          'EQ CƏMİ': row.eqTotal,
          'Ödənilmiş (Əsas)': row.paidEsas || '',
          'Ödəniş Tarixi (Əsas)': row.paidEsas > 0 ? row.odenisTarixi : '',
          'Ödənilmiş (ƏDV)': row.paidEdv || '',
          'Ödəniş Tarixi (ƏDV)': row.paidEdv > 0 ? row.odenisTarixiEdv : '',
          'Ödənilmiş CƏMİ': row.paidTotal,
          'Qalıq (Əsas)': row.qaliqEsas,
          'Qalıq (ƏDV)': row.qaliqEdv,
          'Status': row.status,
        };
        const extra = [];
        if (row.artiqEsas > 0.01) {
          extra.push({ ...empty,
            'Reklam Yayıcısı': '↳ Artıq ödəniş — Əsas hesab (Yayım haqqı yığımı)',
            'EQ Tarixi': row.artiqOdenisTarixi,
            'Qalıq (Əsas)': -row.artiqEsas,
            'Status': 'Artıq Ödəniş (Əsas)',
          });
        }
        if (row.artiqEdv > 0.01) {
          extra.push({ ...empty,
            'Reklam Yayıcısı': '↳ Artıq ödəniş — ƏDV hesab (ƏDV daxilolma)',
            'EQ Tarixi': row.artiqOdenisTarixi,
            'Qalıq (ƏDV)': -row.artiqEdv,
            'Status': 'Artıq Ödəniş (ƏDV)',
          });
        }
        return [main, ...extra];
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
