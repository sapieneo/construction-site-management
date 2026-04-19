import { useState } from 'react';
import Gorevlendirme from './pages/Gorevlendirme';
import Raporlar from './pages/Raporlar';
import SantiyeRaporu from './pages/SantiyeRaporu';
import CalisanTakvimi from './pages/CalisanTakvimi';
import FormModal from './components/FormModal';

const FORM_URLS = {
  calisan: 'https://airtable.com/embed/appSjCZms28kJYT1k/pagTplCV49PxoTWpX/form',
  proje: 'https://airtable.com/embed/appSjCZms28kJYT1k/pagGgoLFYA9gwlTpf/form',
};

const NAV_MAIN = [
  { id: 'gorevlendirme', label: 'Görevlendirme', icon: '🏗️', badge: 'Bugün' },
  { id: 'raporlar',      label: 'Raporlar',       icon: '📊' },
  { id: 'santiye-raporu', label: 'Şantiye Raporu', icon: '📋' },
  { id: 'calisan-takvimi', label: 'Çalışan Takvimi', icon: '📅' },
];

const today = new Date();
const todayFmt = today.toLocaleDateString('tr-TR', {
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
});

function SidebarNav({ aktif, onNav, onAcikModal }) {
  return (
    <aside className="sy-sidebar">
      {/* Logo */}
      <div className="sy-logo">
        <div className="sy-logo__mark">🦺</div>
        <div className="sy-logo__text">
          <b>Şantiye</b>
          <span>Yönetim</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sy-nav">
        <div className="sy-nav__section">Sayfalar</div>
        {NAV_MAIN.map((item) => (
          <button
            key={item.id}
            className="sy-nav__item"
            aria-current={aktif === item.id ? 'page' : undefined}
            onClick={() => onNav(item.id)}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && <span className="sy-nav__badge">{item.badge}</span>}
          </button>
        ))}

        <div className="sy-nav__section">Ekle</div>
        <button className="sy-nav__item" onClick={() => onAcikModal('calisan')}>
          <span style={{ fontSize: 16 }}>👷</span>
          <span>Yeni Çalışan</span>
        </button>
        <button className="sy-nav__item" onClick={() => onAcikModal('proje')}>
          <span style={{ fontSize: 16 }}>🏢</span>
          <span>Yeni Proje</span>
        </button>
      </nav>

      {/* Footer user */}
      <div className="sy-nav__footer">
        <button className="sy-nav__user">
          <div
            className="sy-avatar"
            style={{ background: 'linear-gradient(135deg, oklch(58% 0.12 150), oklch(42% 0.15 150))', color: '#fff', width: 34, height: 34, fontSize: 12 }}
          >
            AŞ
          </div>
          <div className="sy-nav__user-info">
            <b>Şantiye Yönetim</b>
            <span>Yönetici Hesabı</span>
          </div>
        </button>
      </div>
    </aside>
  );
}

function TopBar({ aktifLabel, onAcikModal, reloadKey, setReloadKey, menuAcik, setMenuAcik }) {
  return (
    <header className="sy-topbar">
      {/* Desktop: crumbs */}
      <div className="sy-crumbs sy-desktop-crumbs">
        <span>Dashboard</span>
        <span style={{ color: 'var(--ink-faint)' }}>/</span>
        <b>{aktifLabel}</b>
      </div>

      {/* Desktop: search */}
      <div className="sy-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input placeholder="Ara…" />
      </div>

      {/* Desktop: actions */}
      <div className="sy-topbar-actions sy-desktop-actions">
        <div className="sy-date">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          {todayFmt}
        </div>
        <button className="sy-icon-btn" onClick={() => setReloadKey((k) => k + 1)} title="Yenile">
          🔄
        </button>
        <button className="sy-btn-primary" onClick={() => onAcikModal('calisan')}>
          + Çalışan
        </button>
        <button className="sy-btn-ghost" onClick={() => onAcikModal('proje')}>
          + Proje
        </button>
      </div>

      {/* Mobile: head */}
      <div className="sy-mobile-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🦺</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{aktifLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="sy-icon-btn" onClick={() => setReloadKey((k) => k + 1)} title="Yenile">🔄</button>
          <button
            className="sy-icon-btn"
            onClick={() => setMenuAcik((v) => !v)}
            title="Menü"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}
          >
            {menuAcik ? '✕' : '☰'}
          </button>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [aktifSayfa, setAktifSayfa] = useState('gorevlendirme');
  const [acikModal, setAcikModal] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [menuAcik, setMenuAcik] = useState(false);

  const aktifLabel = NAV_MAIN.find((n) => n.id === aktifSayfa)?.label || '';

  function modalKapat() {
    setAcikModal(null);
    setReloadKey((k) => k + 1);
  }

  function navTo(id) {
    setAktifSayfa(id);
    setMenuAcik(false);
  }

  return (
    <div className="sy-app">
      {/* Sidebar — desktop */}
      <SidebarNav aktif={aktifSayfa} onNav={navTo} onAcikModal={setAcikModal} />

      {/* TopBar */}
      <TopBar
        aktifLabel={aktifLabel}
        onAcikModal={setAcikModal}
        reloadKey={reloadKey}
        setReloadKey={setReloadKey}
        menuAcik={menuAcik}
        setMenuAcik={setMenuAcik}
      />

      {/* Mobile dropdown menu */}
      {menuAcik && (
        <div style={{
          position: 'fixed', top: 60, left: 0, right: 0, zIndex: 40,
          background: 'var(--panel)', borderBottom: '1px solid var(--border)',
          padding: '8px 12px 12px',
          display: 'grid',
        }}
          className="md:hidden"
        >
          {NAV_MAIN.map((item) => (
            <button
              key={item.id}
              className="sy-nav__item"
              aria-current={aktifSayfa === item.id ? 'page' : undefined}
              onClick={() => navTo(item.id)}
              style={{ marginBottom: 2 }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
          <button className="sy-nav__item" onClick={() => { setAcikModal('calisan'); setMenuAcik(false); }}>
            <span style={{ fontSize: 16 }}>👷</span><span>+ Yeni Çalışan</span>
          </button>
          <button className="sy-nav__item" onClick={() => { setAcikModal('proje'); setMenuAcik(false); }}>
            <span style={{ fontSize: 16 }}>🏢</span><span>+ Yeni Proje</span>
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="sy-main">
        {aktifSayfa === 'gorevlendirme' && <Gorevlendirme key={`gov-${reloadKey}`} />}
        {aktifSayfa === 'raporlar' && <Raporlar key={`rap-${reloadKey}`} />}
        {aktifSayfa === 'santiye-raporu' && <SantiyeRaporu key={`sr-${reloadKey}`} />}
        {aktifSayfa === 'calisan-takvimi' && <CalisanTakvimi key={`ct-${reloadKey}`} />}
      </main>

      {/* Mobile bottom tabbar */}
      <nav className="sy-tabbar">
        {NAV_MAIN.map((item) => (
          <button
            key={item.id}
            className="sy-tabbar-btn"
            aria-current={aktifSayfa === item.id ? 'page' : undefined}
            onClick={() => setAktifSayfa(item.id)}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      {/* Mobile FAB */}
      <button className="sy-fab" onClick={() => setAcikModal('calisan')} title="Yeni Çalışan">
        +
      </button>

      {/* Modals */}
      {acikModal === 'calisan' && (
        <FormModal url={FORM_URLS.calisan} baslik="Yeni Çalışan Ekle" onKapat={modalKapat} />
      )}
      {acikModal === 'proje' && (
        <FormModal url={FORM_URLS.proje} baslik="Yeni Proje Ekle" onKapat={modalKapat} />
      )}
    </div>
  );
}
