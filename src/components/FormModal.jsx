import { useEffect } from 'react';

export default function FormModal({ url, baslik, onKapat }) {
  // ESC ile kapat
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onKapat();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onKapat]);

  // Scroll kilit
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onKapat(); }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onKapat}
      />

      {/* Modal kutusu */}
      <div
        className="relative z-10 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '700px', height: '600px', maxWidth: 'calc(100vw - 2rem)', maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 flex-shrink-0">
          <h2 className="font-semibold text-slate-100 text-base">{baslik}</h2>
          <button
            onClick={onKapat}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-100 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* iframe */}
        <div className="flex-1 overflow-hidden">
          <iframe
            src={url}
            frameBorder="0"
            width="100%"
            height="100%"
            style={{ background: 'transparent', border: '1px solid #ccc', display: 'block' }}
            title={baslik}
          />
        </div>

        {/* Alt bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-700 bg-slate-800/80 flex-shrink-0">
          <p className="text-slate-500 text-xs">Formu doldurup gönderdikten sonra bu pencereyi kapatın.</p>
          <button
            onClick={onKapat}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Kapat ve Yenile
          </button>
        </div>
      </div>
    </div>
  );
}
