import { useDroppable } from '@dnd-kit/core';
import Spinner from './Spinner';

// Deterministic color hue from project name
function projeHue(ad) {
  let h = 0;
  for (let i = 0; i < ad.length; i++) h = ad.charCodeAt(i) + ((h << 5) - h);
  const HUES = [32, 215, 150, 285, 12, 340, 225, 90];
  return HUES[Math.abs(h) % HUES.length];
}

function SyAvatar({ ad, soyad, size = 'sm' }) {
  const bas = `${ad?.[0] || ''}${soyad?.[0] || ''}`.toUpperCase();
  const hue = projeHue((ad || '') + (soyad || ''));
  const bg = `linear-gradient(135deg, oklch(58% 0.12 ${hue}), oklch(42% 0.15 ${hue}))`;
  const cls = size === 'xs' ? 'sy-avatar sy-avatar--xs' : 'sy-avatar sy-avatar--sm';
  return (
    <div className={cls} style={{ background: bg, color: '#fff' }}>
      {bas}
    </div>
  );
}

export default function ProjeKutu({ proje, atananCalisanlar, onRemove, loadingIds, onPasifAl }) {
  const { isOver, setNodeRef } = useDroppable({ id: proje.id });
  const hue = projeHue(proje.ad);
  const dotColor = `oklch(62% 0.16 ${hue})`;

  return (
    <div
      ref={setNodeRef}
      className={`sy-project${isOver ? ' is-over' : ''}`}
    >
      {/* Head */}
      <div className="sy-project__head">
        <div className="sy-project__titlerow">
          <span className="sy-project__dot" style={{ background: dotColor }} />
          <span className="sy-project__title">{proje.ad}</span>
          {onPasifAl && (
            <button
              onClick={() => onPasifAl(proje.id)}
              title="Pasife Al"
              style={{
                width: 24, height: 24, borderRadius: 6,
                display: 'grid', placeItems: 'center',
                color: 'var(--ink-mute)', fontSize: 13,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--err)'; e.currentTarget.style.background = 'color-mix(in oklab, var(--err) 12%, transparent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-mute)'; e.currentTarget.style.background = 'transparent'; }}
            >
              ⚙
            </button>
          )}
        </div>
        {proje.musteri && (
          <div className="sy-project__musteri">{proje.musteri}</div>
        )}
      </div>

      {/* Body — assigned workers */}
      <div className="sy-project__body">
        {isOver && atananCalisanlar.length === 0 && (
          <div className="sy-project__empty" style={{ borderColor: 'var(--accent)', color: 'var(--accent-bright)', background: 'var(--accent-soft)' }}>
            <span style={{ fontSize: 18 }}>⊕</span>
            <span>Buraya bırak</span>
          </div>
        )}

        {atananCalisanlar.map((item) => (
          <div key={item.takipId} className="sy-assign">
            <SyAvatar ad={item.calisan.ad} soyad={item.calisan.soyad} size="sm" />
            <div className="sy-assign__info">
              <b>{item.calisan.ad} {item.calisan.soyad}</b>
              {item.calisan.rol && <div className="sy-assign__sub">{item.calisan.rol}</div>}
            </div>
            <button
              onClick={() => onRemove(item.takipId)}
              disabled={loadingIds.has(item.takipId)}
              className="sy-assign__remove"
              title="Görevi kaldır"
            >
              {loadingIds.has(item.takipId) ? <Spinner size="sm" /> : '✕'}
            </button>
          </div>
        ))}

        {!isOver && atananCalisanlar.length === 0 && (
          <div className="sy-project__empty">
            <span style={{ fontSize: 18, color: 'var(--ink-faint)' }}>⊕</span>
            <span>Çalışan sürükleyin</span>
          </div>
        )}
      </div>

      {/* Foot */}
      <div className="sy-project__foot">
        <div className="sy-avatar-stack">
          {atananCalisanlar.slice(0, 4).map((item) => (
            <SyAvatar key={item.takipId} ad={item.calisan.ad} soyad={item.calisan.soyad} size="xs" />
          ))}
          {atananCalisanlar.length > 4 && (
            <div
              className="sy-avatar sy-avatar--xs"
              style={{ background: 'var(--card-2)', color: 'var(--ink-dim)', marginLeft: -4, border: '2px solid var(--panel-2)' }}
            >
              +{atananCalisanlar.length - 4}
            </div>
          )}
        </div>
        <span>{atananCalisanlar.length} kişi atandı</span>
      </div>
    </div>
  );
}
