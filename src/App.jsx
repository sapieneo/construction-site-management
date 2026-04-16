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

const NAV = [
  { id: 'gorevlendirme', label: 'Görevlendirme', icon: '🏗️' },
  { id: 'raporlar', label: 'Raporlar', icon: '📊' },
  { id: 'santiye-raporu', label: 'Şantiye Raporu', icon: '📋' },
  { id: 'calisan-takvimi', label: 'Çalışan Takvimi', icon: '📅' },
];

export default function App() {
  const [aktifSayfa, setAktifSayfa] = useState('gorevlendirme');
  const [acikModal, setAcikModal] = useState(null); // 'calisan' | 'proje' | null
  const [reloadKey, setReloadKey] = useState(0);

  function modalKapat() {
    setAcikModal(null);
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xl">🦺</span>
            <span className="font-bold text-slate-100 text-lg tracking-tight hidden sm:inline">
              Şantiye Yönetim
            </span>
          </div>

          {/* Nav + Ekle + Yenile butonları */}
          <div className="flex items-center gap-2 overflow-x-auto min-w-0">
            <nav className="flex gap-1 flex-shrink-0">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setAktifSayfa(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    aktifSayfa === item.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Ayırıcı */}
            <div className="w-px h-6 bg-slate-700 flex-shrink-0 hidden sm:block" />

            {/* Ekle + Yenile butonları */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setAcikModal('calisan')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                title="Yeni Çalışan Ekle"
              >
                <span className="font-bold text-base leading-none">+</span>
                <span className="hidden sm:inline">Çalışan</span>
              </button>
              <button
                onClick={() => setAcikModal('proje')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-700 hover:bg-blue-600 text-white transition-colors whitespace-nowrap"
                title="Yeni Proje Ekle"
              >
                <span className="font-bold text-base leading-none">+</span>
                <span className="hidden sm:inline">Proje</span>
              </button>

              {/* Yenile butonu */}
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors flex-shrink-0"
                title="Listeyi yenile"
              >
                🔄
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sayfa İçeriği — key ile re-mount tetiklenir */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto">
        {aktifSayfa === 'gorevlendirme' && <Gorevlendirme key={`gov-${reloadKey}`} />}
        {aktifSayfa === 'raporlar' && <Raporlar key={`rap-${reloadKey}`} />}
        {aktifSayfa === 'santiye-raporu' && <SantiyeRaporu key={`sr-${reloadKey}`} />}
        {aktifSayfa === 'calisan-takvimi' && <CalisanTakvimi key={`ct-${reloadKey}`} />}
      </main>

      {/* Modallar */}
      {acikModal === 'calisan' && (
        <FormModal
          url={FORM_URLS.calisan}
          baslik="Yeni Çalışan Ekle"
          onKapat={modalKapat}
        />
      )}
      {acikModal === 'proje' && (
        <FormModal
          url={FORM_URLS.proje}
          baslik="Yeni Proje Ekle"
          onKapat={modalKapat}
        />
      )}
    </div>
  );
}
