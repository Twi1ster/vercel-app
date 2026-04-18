import React, { useState, useEffect } from 'react';
import EQModule from './pages/EQModule';
import BankModule from './pages/BankModule';
import Reconciliation from './pages/Reconciliation';
import './App.css';

// On Vercel: frontend + API are on same domain, so empty string works
const API = '';

export default function App() {
  const [tab, setTab] = useState('eq');
  const [stats, setStats] = useState({});

  const loadStats = () => {
    fetch(`${API}/api/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  };

  useEffect(() => { loadStats(); }, [tab]);

  const fmt = (n) => Number(n || 0).toLocaleString('az-AZ', { minimumFractionDigits: 2 });

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">EQ</span>
            <div className="logo-text">
              <span className="logo-title">İdarəetmə Sistemi</span>
              <span className="logo-sub">Elektron Qaime · Bank Əməliyyatları</span>
            </div>
          </div>
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-label">EQ Sayı</span>
              <span className="stat-val">{stats.eqCount || 0}</span>
            </div>
            <div className="stat-sep" />
            <div className="stat-item">
              <span className="stat-label">EQ Əsas</span>
              <span className="stat-val">₼{fmt(stats.eqTotalEsas)}</span>
            </div>
            <div className="stat-sep" />
            <div className="stat-item">
              <span className="stat-label">Bank MəDaxil</span>
              <span className="stat-val">₼{fmt(stats.bankTotalMedaxil)}</span>
            </div>
            <div className="stat-sep" />
            <div className="stat-item">
              <span className="stat-label">Bank Məxaric</span>
              <span className="stat-val">₼{fmt(stats.bankTotalMexaric)}</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="nav">
        <button className={`nav-btn ${tab === 'eq' ? 'active' : ''}`} onClick={() => setTab('eq')}>
          <span className="nav-icon">01</span> Elektron Qaime
        </button>
        <button className={`nav-btn ${tab === 'bank' ? 'active' : ''}`} onClick={() => setTab('bank')}>
          <span className="nav-icon">02</span> Bank / Hesab
        </button>
        <button className={`nav-btn ${tab === 'rec' ? 'active' : ''}`} onClick={() => setTab('rec')}>
          <span className="nav-icon">03</span> Rekonsiliasiya
        </button>
      </nav>

      <main className="main">
        {tab === 'eq' && <EQModule api={API} onUpdate={loadStats} />}
        {tab === 'bank' && <BankModule api={API} onUpdate={loadStats} />}
        {tab === 'rec' && <Reconciliation api={API} />}
      </main>
    </div>
  );
}
