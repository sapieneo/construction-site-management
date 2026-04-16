import { useDroppable } from '@dnd-kit/core';
import Spinner from './Spinner';

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
];

function avatarRenk(isim) {
  let hash = 0;
  for (let i = 0; i < isim.length; i++) hash = isim.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function MiniAvatar({ calisan }) {
  const bas = `${calisan.ad?.[0] || ''}${calisan.soyad?.[0] || ''}`.toUpperCase();
  if (calisan.resimUrl) {
    return (
      <img
        src={calisan.resimUrl}
        alt={bas}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className={`w-7 h-7 ${avatarRenk(calisan.ad + calisan.soyad)} rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0`}>
      {bas}
    </div>
  );
}

export default function ProjeKutu({ proje, atananCalisanlar, onRemove, loadingIds, onPasifAl }) {
  const { isOver, setNodeRef } = useDroppable({ id: proje.id });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-xl border p-4 transition-all min-h-[120px]
        ${isOver
          ? 'border-blue-400 bg-blue-950/40 shadow-lg shadow-blue-900/30'
          : 'border-slate-700 bg-slate-800/60'
        }
      `}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-100 text-sm leading-tight">{proje.ad}</h3>
          {proje.musteri && (
            <p className="text-slate-400 text-xs mt-0.5">{proje.musteri}</p>
          )}
        </div>
        {onPasifAl && (
          <button
            onClick={() => onPasifAl(proje.id)}
            title="Pasife Al"
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs border border-slate-700 text-slate-600 hover:border-red-500/60 hover:text-red-400 transition-all"
          >
            ⚙
          </button>
        )}
      </div>

      {isOver && atananCalisanlar.length === 0 && (
        <div className="border-2 border-dashed border-blue-500/60 rounded-lg h-10 flex items-center justify-center">
          <span className="text-blue-400 text-xs">Buraya bırak</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {atananCalisanlar.map((item) => (
          <div
            key={item.takipId}
            className="flex items-center justify-between bg-slate-700/70 border border-slate-600 rounded-lg px-3 py-2 gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <MiniAvatar calisan={item.calisan} />
              <div className="min-w-0">
                <p className="text-slate-100 text-sm font-medium leading-tight truncate">
                  {item.calisan.ad} {item.calisan.soyad}
                </p>
                {item.calisan.lakap && (
                  <p className="text-slate-400 text-xs truncate">"{item.calisan.lakap}"</p>
                )}
              </div>
            </div>
            <button
              onClick={() => onRemove(item.takipId)}
              disabled={loadingIds.has(item.takipId)}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-slate-600 hover:bg-red-600 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              title="Görevi kaldır"
            >
              {loadingIds.has(item.takipId) ? (
                <Spinner size="sm" />
              ) : (
                <span className="text-xs font-bold">✕</span>
              )}
            </button>
          </div>
        ))}

        {!isOver && atananCalisanlar.length === 0 && (
          <div className="border-2 border-dashed border-slate-600/50 rounded-lg h-10 flex items-center justify-center">
            <span className="text-slate-600 text-xs">Çalışan sürükle</span>
          </div>
        )}
      </div>
    </div>
  );
}
