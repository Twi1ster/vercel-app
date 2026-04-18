import React, { useState, useEffect } from 'react';

const fmt = n => Number(n || 0).toLocaleString('az-AZ', { minimumFractionDigits: 2 });

export default function Reconciliation({ api }) {
  const [data, setData] = useState([]);
  const [voenFilter, setVoenFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [eqDetail, setEqDetail] = useState([]);
  const [bankDetail, setBankDetail] = useState([]);

  const load = async (v = voenFilter) => {
    setLoading(true);
    try {
      const r = await fetch(`${api}/api/reconciliation?voen=${encodeURIComponent(v)}`);
      const d = await r.json();
      setData(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (row) => {
    setSelected(row);
    const [eq, bank] = await Promise.all([
      fetch(`${api}/api/eq?voen=${encodeURIComponent(row.voen)}&limit=200`).then(r => r.json()),
      fetch(`${api}/api/bank?voen=${encodeURIComponent(row.voen)}&limit=200`).then(r => r.json()),
    ]);
    setEqDetail(eq.data || []);
    setBankDetail(bank.data || []);
  };

  const balanced = data.filter(d => d.status === 'Balansda').length;
  const eqArtiq = data.filter(d => d.status === 'EQ Artıq').length;
  const bankArtiq = data.filter(d => d.status === 'Bank Artıq').length;

  return (
    <div>
      <div className="module-header">
        <div className="module-title"><span>03</span> — Rekonsiliasiya · EQ ↔ Bank</div>
        <div className="toolbar">
          <input className="search-input" placeholder="VOEN ilə filtr..." value={voenFilter}
            onChange={e => setVoenFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(voenFilter)} />
          <button className="btn btn-primary" onClick={() => load(voenFilter)}>
            {loading ? 'Yüklənir...' : '⟳ Yenilə'}
          </button>
        </div>
      </div>

      <div className="recon-summary">
        <div className="recon-card">
          <div className="recon-card-label">Ümumi VOEN Sayı</div>
          <div className="recon-card-val" style={{ color: 'var(--text)' }}>{data.length}</div>
        </div>
        <div className="recon-card">
          <div className="recon-card-label">Balansda</div>
          <div className="recon-card-val" style={{ color: 'var(--green)' }}>{balanced}</div>
        </div>
        <div className="recon-card">
          <div className="recon-card-label">Fərq Var</div>
          <div className="recon-card-val" style={{ color: 'var(--red)' }}>{eqArtiq + bankArtiq}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>VOEN</th>
              <th>EQ Sayı</th>
              <th>EQ Cəmi (Əsas)</th>
              <th>EQ Cəmi (ƏDV)</th>
              <th>EQ CƏMİ</th>
              <th>Bank MəDaxil</th>
              <th>Bank Məxaric</th>
              <th>FƏRQ</th>
              <th>STATUS</th>
              <th>Bank Sayı</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={10}>
                <div className="empty-state"><div className="es-icon">⚖</div>Data tapılmadı</div>
              </td></tr>
            )}
            {data.map(row => (
              <tr key={row.voen} style={{ cursor: 'pointer' }} onClick={() => openDetail(row)}>
                <td style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{row.voen}</td>
                <td className="num">{row.eqCount}</td>
                <td className="num num-pos">{fmt(row.totalEqEsas)}</td>
                <td className="num num-pos">{fmt(row.totalEqEdv)}</td>
                <td className="num" style={{ fontWeight: 700 }}>{fmt(row.totalEq)}</td>
                <td className="num num-pos">{fmt(row.totalMedaxil)}</td>
                <td className="num num-neg">{fmt(row.totalMexaric)}</td>
                <td className={`num ${Math.abs(row.ferq) < 0.01 ? 'num-zero' : row.ferq > 0 ? 'num-neg' : 'num-pos'}`} style={{ fontWeight: 700 }}>
                  {row.ferq > 0 ? '+' : ''}{fmt(row.ferq)}
                </td>
                <td>
                  <span className={`badge ${row.status === 'Balansda' ? 'badge-green' : row.status === 'EQ Artıq' ? 'badge-red' : 'badge-yellow'}`}>
                    {row.status}
                  </span>
                </td>
                <td className="num">{row.bankCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 1000 }}>
            <div className="modal-header">
              <span className="modal-title">VOEN: {selected.voen} — Ətraflı</span>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>

              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderBottom: '1px solid var(--border)' }}>
                {[
                  { l: 'EQ Cəmi', v: fmt(selected.totalEq), c: 'var(--text)' },
                  { l: 'Bank MəDaxil', v: fmt(selected.totalMedaxil), c: 'var(--green)' },
                  { l: 'Fərq', v: (selected.ferq > 0 ? '+' : '') + fmt(selected.ferq), c: Math.abs(selected.ferq) < 0.01 ? 'var(--green)' : 'var(--red)' },
                  { l: 'Status', v: selected.status, c: selected.status === 'Balansda' ? 'var(--green)' : 'var(--red)' },
                ].map(s => (
                  <div key={s.l} style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: s.c, marginTop: 4 }}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {/* EQ list */}
                <div style={{ borderRight: '1px solid var(--border)' }}>
                  <div style={{ padding: '10px 16px', background: 'var(--bg3)', fontSize: 10, letterSpacing: 1, color: 'var(--accent)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>
                    Elektron Qaimelər ({eqDetail.length})
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ width: '100%' }}>
                      <thead><tr>
                        <th>İcazə №</th><th>EQ Tarixi</th><th>Əsas</th><th>ƏDV</th>
                      </tr></thead>
                      <tbody>
                        {eqDetail.map(e => (
                          <tr key={e._id}>
                            <td>{e.icazeNo}</td><td>{e.eqTarixi}</td>
                            <td className="num num-pos">{fmt(e.eqMeblegEsas)}</td>
                            <td className="num num-pos">{fmt(e.eqMeblegEdv)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Bank list */}
                <div>
                  <div style={{ padding: '10px 16px', background: 'var(--bg3)', fontSize: 10, letterSpacing: 1, color: 'var(--blue)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>
                    Bank Əməliyyatları ({bankDetail.length})
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ width: '100%' }}>
                      <thead><tr>
                        <th>Tarix</th><th>MəDaxil</th><th>Məxaric</th><th>№</th>
                      </tr></thead>
                      <tbody>
                        {bankDetail.map(b => (
                          <tr key={b._id}>
                            <td>{b.tarix}</td>
                            <td className="num num-pos">{b.medaxil > 0 ? fmt(b.medaxil) : '—'}</td>
                            <td className="num num-neg">{b.mexaric > 0 ? fmt(b.mexaric) : '—'}</td>
                            <td style={{ fontSize: 10 }}>{b.muracietNomresiEqfNomresi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Bağla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
