import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
];

function avatarRenk(isim) {
  let hash = 0;
  for (let i = 0; i < isim.length; i++) hash = isim.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ calisan, size = 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  const bas = `${calisan.ad?.[0] || ''}${calisan.soyad?.[0] || ''}`.toUpperCase();
  if (calisan.resimUrl) {
    return (
      <img
        src={calisan.resimUrl}
        alt={bas}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${dim} ${avatarRenk(calisan.ad + calisan.soyad)} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}>
      {bas}
    </div>
  );
}

// durum: null | 'atandi' | 'hasta' | 'izinli'
export default function CalisanKart({ calisan, durum, onToggleDurum, onPasifAl, onAta, overlay = false }) {
  const surukleDevre = durum === 'hasta' || durum === 'izinli';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: calisan.id,
    disabled: surukleDevre,
    data: { calisan },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  if (overlay) {
    return (
      <div className="bg-blue-600 border border-blue-400 rounded-lg px-3 py-2 shadow-xl cursor-grabbing select-none flex items-center gap-2.5">
        <Avatar calisan={calisan} />
        <div>
          <p className="font-semibold text-white text-sm leading-tight">
            {calisan.ad} {calisan.soyad}
          </p>
          {calisan.lakap && (
            <p className="text-blue-200 text-xs">"{calisan.lakap}"</p>
          )}
        </div>
      </div>
    );
  }

  // Kart arka plan / kenarlık duruma göre
  let kartClass = '';
  if (isDragging) {
    kartClass = 'opacity-30 cursor-grabbing bg-blue-900/40 border-blue-700';
  } else if (durum === 'hasta') {
    kartClass = 'bg-amber-900/30 border-amber-600/60 cursor-not-allowed';
  } else if (durum === 'izinli') {
    kartClass = 'bg-blue-900/30 border-blue-500/60 cursor-not-allowed';
  } else if (durum === 'atandi') {
    kartClass = 'bg-slate-800/60 border-emerald-800/60 opacity-70 cursor-grab hover:border-emerald-600 hover:opacity-90';
  } else {
    kartClass = 'bg-slate-800 border-slate-600 cursor-grab hover:border-blue-500 hover:bg-slate-700 active:cursor-grabbing';
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!surukleDevre ? { ...listeners, ...attributes } : {})}
      className={`rounded-lg border px-3 py-2 select-none transition-all flex items-center gap-2.5 ${kartClass}`}
    >
      <Avatar calisan={calisan} />

      {/* İsim ve bilgiler */}
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-sm leading-tight truncate ${
          durum === 'hasta' ? 'text-amber-200' :
          durum === 'izinli' ? 'text-blue-200' :
          durum === 'atandi' ? 'text-slate-300' :
          'text-slate-100'
        }`}>
          {calisan.ad} {calisan.soyad}
        </p>
        {calisan.lakap && (
          <p className="text-xs truncate text-slate-500">"{calisan.lakap}"</p>
        )}
        {calisan.rol && (
          <p className="text-xs truncate text-slate-600">{calisan.rol}</p>
        )}
      </div>

      {/* Durum göstergesi (atandı) */}
      {durum === 'atandi' && (
        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Projeye atandı" />
      )}

      {/* Mobil "Ata" butonu */}
      {onAta && durum !== 'hasta' && durum !== 'izinli' && (
        <button
          onClick={(e) => { e.stopPropagation(); onAta(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="sm:hidden flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors"
        >
          Ata
        </button>
      )}

      {/* H / İ / ⚙️ butonları */}
      <div
        className="flex gap-1 flex-shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDurum?.(calisan.id, 'hasta'); }}
          title="Hasta"
          className={`w-6 h-6 rounded text-xs font-bold transition-all ${
            durum === 'hasta'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-900/40'
              : 'bg-transparent border border-slate-600 text-slate-500 hover:border-amber-500 hover:text-amber-400'
          }`}
        >
          H
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDurum?.(calisan.id, 'izinli'); }}
          title="İzinli"
          className={`w-6 h-6 rounded text-xs font-bold transition-all ${
            durum === 'izinli'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-900/40'
              : 'bg-transparent border border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-400'
          }`}
        >
          İ
        </button>
        {onPasifAl && (
          <button
            onClick={(e) => { e.stopPropagation(); onPasifAl(calisan.id); }}
            title="Pasife Al"
            className="w-6 h-6 rounded text-xs transition-all bg-transparent border border-slate-700 text-slate-600 hover:border-red-500/60 hover:text-red-400"
          >
            ⚙
          </button>
        )}
      </div>
    </div>
  );
}
