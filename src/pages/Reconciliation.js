import React, { useState, useEffect } from 'react';

const fmt = n => Number(n || 0).toLocaleString('az-AZ', { minimumFractionDigits: 2 });

const STATUS_STYLE = {
  'Tam Ödənilmiş':   { color: 'var(--green)',  bg: 'rgba(76,175,80,0.12)' },
  'Artıq Ödəniş':    { color: 'var(--yellow)', bg: 'rgba(255,193,7,0.12)' },
  'Qismən Ödənilmiş':{ color: 'var(--blue)',   bg: 'rgba(33,150,243,0.12)' },
  'Ödənilməyib':     { color: 'var(--red)',     bg: 'rgba(244,67,54,0.12)' },
};

export default function Reconciliation({ api }) {
  const [data, setData]       = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async (s = search) => {
    setLoading(true);
    try {
      const r = await fetch(`${api}/api/reconciliation?search=${encodeURIComponent(s)}`);
      const d = await r.json();
      setData(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter ? data.filter(d => d.status === statusFilter) : data;

  const counts = {
    tamOdenilmish:    data.filter(d => d.status === 'Tam Ödənilmiş').length,
    artiqOdenis:      data.filter(d => d.status === 'Artıq Ödəniş').length,
    qismenOdenilmish: data.filter(d => d.status === 'Qismən Ödənilmiş').length,
    odenilmeyib:      data.filter(d => d.status === 'Ödənilməyib').length,
  };

  const totalArtiq = data.reduce((s, d) => s + (d.artiqOdenis || 0), 0);

  return (
    <div>
      <div className="module-header">
        <div className="module-title"><span>03</span> — Rekonsiliasiya · EQ Ödəniş Statusu</div>
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="VÖEN, İcazə №, Reklam Yayıcısı..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search)}
          />
          <button className="btn btn-primary" onClick={() => load(search)}>
            {loading ? 'Yüklənir...' : '⟳ Yenilə'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="recon-summary">
        {[
          { label: 'Tam Ödənilmiş',    val: counts.tamOdenilmish,    key: 'Tam Ödənilmiş',    color: 'var(--green)'  },
          { label: 'Artıq Ödəniş',     val: counts.artiqOdenis,      key: 'Artıq Ödəniş',     color: 'var(--yellow)' },
          { label: 'Qismən Ödənilmiş', val: counts.qismenOdenilmish, key: 'Qismən Ödənilmiş', color: 'var(--blue)'   },
          { label: 'Ödənilməyib',      val: counts.odenilmeyib,      key: 'Ödənilməyib',      color: 'var(--red)'    },
        ].map(c => (
          <div
            key={c.key}
            className="recon-card"
            style={{ cursor: 'pointer', outline: statusFilter === c.key ? `2px solid ${c.color}` : 'none' }}
            onClick={() => setStatusFilter(prev => prev === c.key ? '' : c.key)}
          >
            <div className="recon-card-label">{c.label}</div>
            <div className="recon-card-val" style={{ color: c.color }}>{c.val}</div>
          </div>
        ))}
        {totalArtiq > 0 && (
          <div className="recon-card" style={{ gridColumn: 'span 2' }}>
            <div className="recon-card-label">Ümumi Artıq Ödəniş Məbləği</div>
            <div className="recon-card-val" style={{ color: 'var(--yellow)', fontSize: 20 }}>{fmt(totalArtiq)} ₼</div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>VÖEN</th>
              <th>Reklam Yayıcısı</th>
              <th>İcazə №</th>
              <th>EQ Tarixi</th>
              <th className="num">EQ Əsas</th>
              <th className="num">EQ ƏDV</th>
              <th className="num">EQ CƏMİ</th>
              <th className="num">Ödənilmiş (Əsas)</th>
              <th className="num">Ödənilmiş (ƏDV)</th>
              <th className="num">Ödənilmiş CƏMİ</th>
              <th className="num">Qalıq</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={13}>
                <div className="empty-state"><div className="es-icon">⚖</div>Qeyd tapılmadı</div>
              </td></tr>
            )}
            {filtered.map((row, i) => {
              const st = STATUS_STYLE[row.status] || {};
              return (
                <React.Fragment key={row._id}>
                  <tr style={{ background: row.artiqOdenis > 0 ? 'rgba(255,193,7,0.05)' : undefined }}>
                    <td className="num" style={{ color: 'var(--text3)' }}>{i + 1}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--mono)' }}>{row.voen}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.reklamYayicisi}</td>
                    <td>{row.icazeNo}</td>
                    <td>{row.eqTarixi}</td>
                    <td className="num num-pos">{fmt(row.eqMeblegEsas)}</td>
                    <td className="num num-pos">{fmt(row.eqMeblegEdv)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{fmt(row.eqTotal)}</td>
                    <td className="num num-pos">{row.paidEsas > 0 ? fmt(row.paidEsas) : '—'}</td>
                    <td className="num num-pos">{row.paidEdv > 0 ? fmt(row.paidEdv) : '—'}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{row.paidTotal > 0 ? fmt(row.paidTotal) : '—'}</td>
                    <td className="num" style={{ fontWeight: 700, color: Math.abs(row.qaliq) < 0.01 ? 'var(--green)' : row.qaliq > 0 ? 'var(--red)' : 'var(--yellow)' }}>
                      {Math.abs(row.qaliq) < 0.01 ? '✓' : fmt(row.qaliq)}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 4,
                        fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)',
                        color: st.color, background: st.bg,
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>

                  {/* Artıq ödəniş extra row */}
                  {row.artiqOdenis > 0 && (
                    <tr style={{ background: 'rgba(255,193,7,0.08)' }}>
                      <td></td>
                      <td colSpan={3} style={{ paddingLeft: 24, color: 'var(--yellow)', fontSize: 12, fontStyle: 'italic' }}>
                        ↳ Artıq ödəniş
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                        {row.artiqOdenisTarixi || '—'}
                      </td>
                      <td colSpan={6}></td>
                      <td className="num" style={{ fontWeight: 700, color: 'var(--yellow)', fontSize: 13 }}>
                        +{fmt(row.artiqOdenis)} ₼
                      </td>
                      <td></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
