import { useState, useEffect } from 'react';
import Spinner from './Spinner';

function bugunStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function KayitFormModal({ baslik, onKaydet, onKapat }) {
  const [tarih, setTarih] = useState(bugunStr());
  const [tutar, setTutar] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onKapat(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onKapat]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tarih || !tutar || Number(tutar) <= 0) return;
    setLoading(true);
    setHata(null);
    try {
      await onKaydet({ tarih, tutar: Number(tutar), aciklama });
      onKapat();
    } catch (err) {
      setHata(err.message);
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onKapat(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onKapat} />

      <div className="relative z-10 w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-slate-100 text-base">{baslik}</h2>
          <button
            onClick={onKapat}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-100 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {hata && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
              {hata}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 text-sm">Tarih</label>
            <input
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              required
              className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 text-sm">Tutar (₺)</label>
            <input
              type="number"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              min="1"
              step="1"
              required
              placeholder="0"
              className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 text-sm">
              Açıklama <span className="text-slate-600">(isteğe bağlı)</span>
            </label>
            <input
              type="text"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Açıklama..."
              className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onKapat}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg py-2 text-sm font-medium transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading || !tarih || !tutar || Number(tutar) <= 0}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              {loading && <Spinner size="sm" />}
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
