import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function avatarHue(isim) {
  const HUES = [32, 215, 150, 285, 12, 340, 225, 90, 180, 260, 60, 310];
  let h = 0;
  for (let i = 0; i < isim.length; i++) h = isim.charCodeAt(i) + ((h << 5) - h);
  return HUES[Math.abs(h) % HUES.length];
}

function SyAvatar({ calisan }) {
  const bas = `${calisan.ad?.[0] || ''}${calisan.soyad?.[0] || ''}`.toUpperCase();
  const hue = avatarHue(calisan.ad + calisan.soyad);
  if (calisan.resimUrl) {
    return (
      <img
        src={calisan.resimUrl}
        alt={bas}
        className="sy-avatar"
        style={{ objectFit: 'cover' }}
      />
    );
  }
  return (
    <div
      className="sy-avatar"
      style={{
        background: `linear-gradient(135deg, oklch(58% 0.12 ${hue}), oklch(42% 0.15 ${hue}))`,
        color: '#fff',
      }}
    >
      {bas}
    </div>
  );
}

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
      <div
        className="sy-worker"
        style={{
          background: 'var(--accent)',
          border: '1px solid var(--accent-bright)',
          borderRadius: 'var(--r-sm)',
          padding: '10px 12px',
          boxShadow: 'var(--shadow-lg)',
          cursor: 'grabbing',
          opacity: 1,
        }}
      >
        <SyAvatar calisan={calisan} />
        <div className="sy-worker__info">
          <b style={{ color: 'var(--accent-ink)', fontFamily: 'var(--font-display)' }}>
            {calisan.ad} {calisan.soyad}
          </b>
          {calisan.rol && <div className="sy-worker__role" style={{ color: 'color-mix(in oklab, var(--accent-ink) 70%, transparent)' }}>{calisan.rol}</div>}
        </div>
      </div>
    );
  }

  let workerClass = 'sy-worker';
  if (isDragging) workerClass += ' is-dragging';
  else if (durum === 'hasta') workerClass += ' is-hasta';
  else if (durum === 'izinli') workerClass += ' is-izinli';
  else if (durum === 'atandi') workerClass += ' is-assigned';

  const statusDot = durum === 'hasta' ? 's-sick' : durum === 'izinli' ? 's-leave' : 's-on';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!surukleDevre ? { ...listeners, ...attributes } : {})}
      className={workerClass}
    >
      {/* Avatar with status dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <SyAvatar calisan={calisan} />
        <span className={`sy-sdot ${statusDot}`} style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--panel)' }} />
      </div>

      {/* Info */}
      <div className="sy-worker__info">
        <b>{calisan.ad} {calisan.soyad}</b>
        <div className="sy-worker__role">
          {calisan.rol || ''}
          {calisan.lakap && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-faint)', marginLeft: 4 }}>"{calisan.lakap}"</span>}
        </div>
      </div>

      {/* Status badge */}
      {durum === 'hasta' && <span className="sy-worker__status s-hasta">Hasta</span>}
      {durum === 'izinli' && <span className="sy-worker__status s-izinli">İzinli</span>}
      {durum === 'atandi' && <span className="sy-worker__status s-atandi">Atandı</span>}

      {/* Mobile "Ata" button */}
      {onAta && durum !== 'hasta' && durum !== 'izinli' && (
        <button
          onClick={(e) => { e.stopPropagation(); onAta(); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            flexShrink: 0,
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            border: 'none',
            cursor: 'pointer',
          }}
          className="sy-mobile-ata"
        >
          +
        </button>
      )}

      {/* H / İ / ⚙ toggles */}
      <div
        className="sy-worker__tools"
        onPointerDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: undefined }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDurum?.(calisan.id, 'hasta'); }}
          title="Hasta"
          style={{
            width: 22, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 700,
            border: `1px solid ${durum === 'hasta' ? 'transparent' : 'var(--border-strong)'}`,
            background: durum === 'hasta' ? 'var(--warn)' : 'transparent',
            color: durum === 'hasta' ? '#fff' : 'var(--ink-mute)',
            cursor: 'pointer',
          }}
        >H</button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDurum?.(calisan.id, 'izinli'); }}
          title="İzinli"
          style={{
            width: 22, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 700,
            border: `1px solid ${durum === 'izinli' ? 'transparent' : 'var(--border-strong)'}`,
            background: durum === 'izinli' ? 'var(--ok)' : 'transparent',
            color: durum === 'izinli' ? '#fff' : 'var(--ink-mute)',
            cursor: 'pointer',
          }}
        >İ</button>
        {onPasifAl && (
          <button
            onClick={(e) => { e.stopPropagation(); onPasifAl(calisan.id); }}
            title="Pasife Al"
            style={{
              width: 22, height: 22, borderRadius: 5, fontSize: 11,
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--ink-faint)',
              cursor: 'pointer',
            }}
          >⚙</button>
        )}
      </div>
    </div>
  );
}
