import { useState, useEffect, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  getCalisanlarAktif,
  getProjelerAktif,
  getTakipByTarih,
  deleteTakipKayitlariBatch,
  createTakipKayitlariBatch,
  pasifCalisanAl,
  pasifProjeAl,
  formatTarih,
  yarin,
} from '../lib/airtable';
import CalisanKart from '../components/CalisanKart';
import ProjeKutu from '../components/ProjeKutu';
import Spinner from '../components/Spinner';

// Yüklenen kayıtları normal atamalar, hasta ve izinliler olarak ayır
function kayitlariAyristir(kayitlar) {
  const normalTakipler = [];
  const durumlar = {};
  for (const k of kayitlar) {
    if (k.kayitAd?.startsWith('HASTA - ') && k.calisanId) {
      durumlar[k.calisanId] = 'hasta';
    } else if (k.kayitAd?.startsWith('İZİNLİ - ') && k.calisanId) {
      durumlar[k.calisanId] = 'izinli';
    } else {
      normalTakipler.push(k);
    }
  }
  return { normalTakipler, durumlar };
}

export default function Gorevlendirme() {
  const [tarih, setTarih] = useState(yarin());
  const [calisanlar, setCalisanlar] = useState([]);
  const [projeler, setProjeler] = useState([]);
  const [takipler, setTakipler] = useState([]);           // sadece proje atamaları
  const [durumlar, setDurumlar] = useState({});            // {calisanId: 'hasta'|'izinli'}
  const [kaydedilmisSnapshot, setKaydedilmisSnapshot] = useState([]); // tüm kayıtlar (normal+hasta+izinli)
  const [loading, setLoading] = useState(true);
  const [hata, setHata] = useState(null);
  const [aktifCalisan, setAktifCalisan] = useState(null);
  const [kaydetmeYukluyor, setKaydetmeYukluyor] = useState(false);
  const [basariMesaj, setBasariMesaj] = useState(null);
  const [ataModal, setAtaModal] = useState(null); // mobil atama için { calisan }
  const kaydetmeKilidi = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Kaydedilmemiş değişiklik kontrolü — takipler ve durumlar birlikte
  const kaydedilmemisDegisiklik = useMemo(() => {
    // Mevcut durum: proje atamaları + hasta/izinli
    const currentPairs = new Set(takipler.map((t) => `${t.calisanId}:${t.projeId}`));
    for (const [id, d] of Object.entries(durumlar)) {
      if (d) currentPairs.add(`${id}:${d}`);
    }

    // Snapshot'taki durum
    const savedPairs = new Set();
    for (const k of kaydedilmisSnapshot) {
      if (k.kayitAd?.startsWith('HASTA - ')) {
        savedPairs.add(`${k.calisanId}:hasta`);
      } else if (k.kayitAd?.startsWith('İZİNLİ - ')) {
        savedPairs.add(`${k.calisanId}:izinli`);
      } else {
        savedPairs.add(`${k.calisanId}:${k.projeId}`);
      }
    }

    if (currentPairs.size !== savedPairs.size) return true;
    for (const key of currentPairs) {
      if (!savedPairs.has(key)) return true;
    }
    return false;
  }, [takipler, durumlar, kaydedilmisSnapshot]);

  useEffect(() => {
    ilkYukle();
  }, []); // eslint-disable-line

  async function ilkYukle() {
    setLoading(true);
    setHata(null);
    try {
      const [c, p, t] = await Promise.all([
        getCalisanlarAktif(),
        getProjelerAktif(),
        getTakipByTarih(tarih),
      ]);
      const { normalTakipler, durumlar: yuklenenDurumlar } = kayitlariAyristir(t);
      setCalisanlar(c);
      setProjeler(p);
      setTakipler(normalTakipler);
      setDurumlar(yuklenenDurumlar);
      setKaydedilmisSnapshot(t);
    } catch (e) {
      setHata(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function tarihDegistir(yeniTarih) {
    setTarih(yeniTarih);
    setLoading(true);
    setHata(null);
    setBasariMesaj(null);
    try {
      const t = await getTakipByTarih(yeniTarih);
      const { normalTakipler, durumlar: yuklenenDurumlar } = kayitlariAyristir(t);
      setTakipler(normalTakipler);
      setDurumlar(yuklenenDurumlar);
      setKaydedilmisSnapshot(t);
    } catch (e) {
      setHata(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleDurum(calisanId, durum) {
    const yeniDurum = durumlar[calisanId] === durum ? null : durum;
    // Hasta/izinli seçiliyorsa projeden çıkar
    if (yeniDurum) {
      setTakipler((prev) => prev.filter((t) => t.calisanId !== calisanId));
    }
    setDurumlar((prev) => ({ ...prev, [calisanId]: yeniDurum }));
  }

  function atanmisCalisanIds() {
    return new Set(takipler.map((t) => t.calisanId).filter(Boolean));
  }

  function projeyeAtananlar(projeId) {
    return takipler
      .filter((t) => t.projeId === projeId)
      .map((t) => {
        const calisan = calisanlar.find((c) => c.id === t.calisanId);
        return calisan ? { takipId: t.id, calisan } : null;
      })
      .filter(Boolean);
  }

  // Çalışanın o günkü durumu: null | 'atandi' | 'hasta' | 'izinli'
  function calisanDurum(calisanId) {
    if (durumlar[calisanId]) return durumlar[calisanId];
    if (atanmisCalisanIds().has(calisanId)) return 'atandi';
    return null;
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setAktifCalisan(null);
    if (!over) return;

    const calisanId = String(active.id);
    const projeId = String(over.id);

    // Hasta veya izinli ise atama yapma
    if (durumlar[calisanId]) return;

    const calisan = calisanlar.find((c) => c.id === calisanId);
    const proje = projeler.find((p) => p.id === projeId);
    if (!calisan || !proje) return;

    // Zaten bu projede mi?
    const mevcutAtama = takipler.find((t) => t.calisanId === calisanId);
    if (mevcutAtama) {
      if (mevcutAtama.projeId === projeId) return;
      setHata(`${calisan.ad} ${calisan.soyad} bugün zaten bir projeye atandı. Önce mevcut atamayı kaldırın.`);
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const kayitAd = `${calisan.ad} ${calisan.soyad} - ${formatTarih(tarih)} - ${proje.ad}`;
    setTakipler((prev) => [
      ...prev,
      { id: tempId, kayitAd, tarih, calisanId, projeId },
    ]);
  }

  function handleRemove(takipId) {
    setTakipler((prev) => prev.filter((t) => t.id !== takipId));
  }

  function handleMobileAta(calisanId, projeId) {
    if (durumlar[calisanId]) return;
    const calisan = calisanlar.find((c) => c.id === calisanId);
    const proje = projeler.find((p) => p.id === projeId);
    if (!calisan || !proje) return;
    const mevcutAtama = takipler.find((t) => t.calisanId === calisanId);
    if (mevcutAtama) {
      if (mevcutAtama.projeId === projeId) return;
      setHata(`${calisan.ad} ${calisan.soyad} bugün zaten bir projeye atandı. Önce mevcut atamayı kaldırın.`);
      return;
    }
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const kayitAd = `${calisan.ad} ${calisan.soyad} - ${formatTarih(tarih)} - ${proje.ad}`;
    setTakipler((prev) => [...prev, { id: tempId, kayitAd, tarih, calisanId, projeId }]);
  }

  async function handleGorevlendir() {
    if (kaydetmeKilidi.current) return;
    kaydetmeKilidi.current = true;
    setKaydetmeYukluyor(true);
    setHata(null);
    setBasariMesaj(null);
    try {
      // 1. Snapshot'taki tüm kayıtları sil
      const silinecekIdler = kaydedilmisSnapshot.map((k) => k.id);
      if (silinecekIdler.length > 0) {
        await deleteTakipKayitlariBatch(silinecekIdler);
      }

      // 2. Tüm kayıtları oluştur (normal + hasta + izinli)
      const kayitlar = [];

      // Normal proje atamaları
      for (const t of takipler) {
        const calisan = calisanlar.find((c) => c.id === t.calisanId);
        const proje = projeler.find((p) => p.id === t.projeId);
        kayitlar.push({
          tarih,
          calisanId: t.calisanId,
          projeId: t.projeId,
          kayitAd: `${calisan.ad} ${calisan.soyad} - ${formatTarih(tarih)} - ${proje.ad}`,
        });
      }

      // Hasta / izinli
      for (const [calisanId, durum] of Object.entries(durumlar)) {
        if (!durum) continue;
        const calisan = calisanlar.find((c) => c.id === calisanId);
        if (!calisan) continue;
        const prefix = durum === 'hasta' ? 'HASTA' : 'İZİNLİ';
        kayitlar.push({
          tarih,
          calisanId,
          projeId: null,
          kayitAd: `${prefix} - ${calisan.ad} ${calisan.soyad} - ${formatTarih(tarih)}`,
        });
      }

      let yeniTumKayitlar = [];
      if (kayitlar.length > 0) {
        yeniTumKayitlar = await createTakipKayitlariBatch(kayitlar);
      }

      // Yeni snapshot = tüm kaydedilen kayıtlar
      setKaydedilmisSnapshot(yeniTumKayitlar);
      // takipler = sadece proje atamaları (hasta/izinli hariç)
      const { normalTakipler } = kayitlariAyristir(yeniTumKayitlar);
      setTakipler(normalTakipler);
      setBasariMesaj('Görevlendirme kaydedildi!');
      setTimeout(() => setBasariMesaj(null), 3000);
    } catch (e) {
      setHata(e.message);
    } finally {
      kaydetmeKilidi.current = false;
      setKaydetmeYukluyor(false);
    }
  }

  async function handlePasifCalisanAl(calisanId) {
    const calisan = calisanlar.find((c) => c.id === calisanId);
    if (!calisan) return;
    if (!window.confirm(`"${calisan.ad} ${calisan.soyad}" adlı çalışanı pasife almak istediğinize emin misiniz?`)) return;
    try {
      await pasifCalisanAl(calisanId);
      setCalisanlar((prev) => prev.filter((c) => c.id !== calisanId));
      setTakipler((prev) => prev.filter((t) => t.calisanId !== calisanId));
      setDurumlar((prev) => { const n = { ...prev }; delete n[calisanId]; return n; });
    } catch (e) {
      setHata(e.message);
    }
  }

  async function handlePasifProjeAl(projeId) {
    const proje = projeler.find((p) => p.id === projeId);
    if (!proje) return;
    if (!window.confirm(`"${proje.ad}" projesini pasife almak istediğinize emin misiniz?`)) return;
    try {
      await pasifProjeAl(projeId);
      setProjeler((prev) => prev.filter((p) => p.id !== projeId));
      setTakipler((prev) => prev.filter((t) => t.projeId !== projeId));
    } catch (e) {
      setHata(e.message);
    }
  }

  const totalAtanmis = atanmisCalisanIds().size;
  const muzaitSayisi = calisanlar.filter(c => !atanmisCalisanIds().has(c.id) && !durumlar[c.id]).length;
  const hastaSayisi = Object.values(durumlar).filter(d => d === 'hasta').length;

  return (
    <div>
      {/* Page header */}
      <div className="sy-page-head">
        <div>
          <h1>
            Görevlendirme
            <span className="sy-count">{totalAtanmis} / {calisanlar.length} atandı</span>
          </h1>
          <p style={{ marginTop: 6, color: 'var(--ink-mute)', fontSize: 13 }}>
            Çalışanları projelere sürükleyin — mobilde çalışana dokunun.
          </p>
        </div>
        <div className="sy-page-head__right">
          {loading && <Spinner />}
          <label style={{ color: 'var(--ink-mute)', fontSize: 13 }}>Tarih:</label>
          <input
            type="date"
            value={tarih}
            onChange={(e) => tarihDegistir(e.target.value)}
            style={{
              background: 'var(--card-2)', border: '1px solid var(--border)',
              color: 'var(--ink)', borderRadius: 'var(--r-sm)',
              padding: '8px 12px', fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={handleGorevlendir}
            disabled={kaydetmeYukluyor || loading}
            className="sy-btn-primary"
            style={{ opacity: (kaydetmeYukluyor || loading) ? 0.6 : 1 }}
          >
            {kaydetmeYukluyor && <Spinner size="sm" />}
            {kaydetmeYukluyor ? 'Kaydediliyor…' : '✓ Görevlendir'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sy-kpis">
        <div className="sy-kpi sy-kpi--accent">
          <div className="sy-kpi__label">🏗️ Atanmış Görev</div>
          <div className="sy-kpi__value">
            {totalAtanmis}
            <span className="sy-kpi__unit">/ {calisanlar.length} kişi</span>
          </div>
          <div className="sy-kpi__sub">Bugün sahaya çıkan</div>
          <div className="sy-kpi__progress">
            <span className="sy-kpi__progress-fill" style={{ width: calisanlar.length ? `${Math.round(totalAtanmis / calisanlar.length * 100)}%` : '0%' }} />
          </div>
        </div>
        <div className="sy-kpi">
          <div className="sy-kpi__label">✅ Müsait</div>
          <div className="sy-kpi__value">{muzaitSayisi}</div>
          <div className="sy-kpi__sub">Atanmayı bekliyor</div>
        </div>
        <div className="sy-kpi">
          <div className="sy-kpi__label">🏢 Aktif Proje</div>
          <div className="sy-kpi__value">{projeler.length}</div>
          <div className="sy-kpi__sub">Aktif projeler</div>
        </div>
        <div className="sy-kpi">
          <div className="sy-kpi__label">⚠️ Hasta / İzinli</div>
          <div className="sy-kpi__value">{hastaSayisi + (Object.values(durumlar).filter(d => d === 'izinli').length)}</div>
          <div className="sy-kpi__sub">Bugün yok</div>
        </div>
      </div>

      {/* Banners */}
      {kaydedilmemisDegisiklik && !kaydetmeYukluyor && (
        <div className="sy-banner sy-banner--warn">
          <span>⚠</span>
          Kaydedilmemiş değişiklikler var — Görevlendir butonuna basmayı unutmayın!
        </div>
      )}
      {basariMesaj && (
        <div className="sy-banner sy-banner--ok">
          <span>✓</span>
          {basariMesaj}
        </div>
      )}
      {hata && (
        <div className="sy-banner sy-banner--err" style={{ justifyContent: 'space-between' }}>
          <span>Hata: {hata}</span>
          <button onClick={() => setHata(null)} style={{ color: 'inherit', opacity: 0.7, fontSize: 16 }}>✕</button>
        </div>
      )}

      {loading && calisanlar.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
          <div style={{ textAlign: 'center' }}>
            <Spinner size="lg" />
            <p style={{ color: 'var(--ink-mute)', fontSize: 13, marginTop: 12 }}>Veriler yükleniyor…</p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => {
            const calisan = calisanlar.find((c) => c.id === e.active.id);
            setAktifCalisan(calisan || null);
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setAktifCalisan(null)}
        >
          <div className="sy-board">
            {/* Sol: Çalışanlar paneli */}
            <aside className="sy-worker-panel">
              <div className="sy-worker-panel__head">
                <div className="sy-worker-panel__title">
                  <h3>👷 Çalışanlar</h3>
                  <span className="sy-worker-panel__count">{calisanlar.filter(c => !durumlar[c.id]).length} aktif</span>
                </div>
                <div className="sy-chips">
                  <button className="sy-chip" aria-pressed="true">Hepsi · {calisanlar.length}</button>
                  <button className="sy-chip">
                    <span className="dot-s" />Müsait · {muzaitSayisi}
                  </button>
                  <button className="sy-chip">Atanmış · {totalAtanmis}</button>
                </div>
              </div>
              <div className="sy-worker-list">
                {calisanlar.map((calisan) => (
                  <CalisanKart
                    key={calisan.id}
                    calisan={calisan}
                    durum={calisanDurum(calisan.id)}
                    onToggleDurum={toggleDurum}
                    onPasifAl={handlePasifCalisanAl}
                    onAta={() => setAtaModal(calisan)}
                  />
                ))}
              </div>
            </aside>

            {/* Sağ: Projeler */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="sy-board-label">Projeler</span>
                <button className="sy-chip" aria-pressed="true">Hepsi · {projeler.length}</button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button className="sy-btn-ghost" onClick={() => setAtaModal(null)}>
                    + Proje Ekle
                  </button>
                </div>
              </div>
              <div className="sy-projects-grid">
                {projeler.map((proje) => (
                  <ProjeKutu
                    key={proje.id}
                    proje={proje}
                    atananCalisanlar={projeyeAtananlar(proje.id)}
                    onRemove={handleRemove}
                    loadingIds={new Set()}
                    onPasifAl={handlePasifProjeAl}
                  />
                ))}
              </div>
            </div>
          </div>

          <DragOverlay>
            {aktifCalisan && (
              <CalisanKart calisan={aktifCalisan} durum={null} overlay />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Mobil: Proje seçim bottom sheet */}
      {ataModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
          zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 420,
            maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-pop)',
          }}>
            {/* Grab handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '12px auto 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 12px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{ataModal.ad} {ataModal.soyad}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>Hangi projeye atanacak?</div>
              </div>
              <button
                onClick={() => setAtaModal(null)}
                className="sy-icon-btn"
              >✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projeler.map((proje) => {
                const zatenAtandi = takipler.find(t => t.calisanId === ataModal.id && t.projeId === proje.id);
                return (
                  <button
                    key={proje.id}
                    onClick={() => { handleMobileAta(ataModal.id, proje.id); setAtaModal(null); }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '12px 16px', borderRadius: 'var(--r-md)',
                      background: zatenAtandi ? 'color-mix(in oklab, var(--ok) 10%, transparent)' : 'var(--card-2)',
                      border: `1px solid ${zatenAtandi ? 'color-mix(in oklab, var(--ok) 30%, transparent)' : 'var(--border)'}`,
                      color: zatenAtandi ? 'var(--ok)' : 'var(--ink)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'background 0.12s',
                    }}
                  >
                    <span>{proje.ad}</span>
                    {zatenAtandi && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>ATANDI ✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
