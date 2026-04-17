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

  return (
    <div className="p-4 sm:p-8">
      {/* Başlık + Tarih + Görevlendir Butonu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Görevlendirme</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            <span className="hidden sm:inline">Çalışanları projelere sürükleyerek atayın</span>
            <span className="sm:hidden">Çalışana tıklayıp projeye atayın</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {loading && <Spinner />}
          <label className="text-slate-400 text-sm">Tarih:</label>
          <input
            type="date"
            value={tarih}
            onChange={(e) => tarihDegistir(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleGorevlendir}
            disabled={kaydetmeYukluyor || loading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-green-900 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm shadow-lg shadow-green-900/30"
          >
            {kaydetmeYukluyor && <Spinner size="sm" />}
            {kaydetmeYukluyor ? 'Kaydediliyor...' : 'Görevlendir'}
          </button>
        </div>
      </div>

      {/* Kaydedilmemiş değişiklik uyarısı */}
      {kaydedilmemisDegisiklik && !kaydetmeYukluyor && (
        <div className="mb-4 bg-amber-900/30 border border-amber-600/70 text-amber-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <span className="text-amber-400 text-base">⚠</span>
          Kaydedilmemiş değişiklikler var — Görevlendir butonuna basmayı unutmayın!
        </div>
      )}

      {/* Başarı mesajı */}
      {basariMesaj && (
        <div className="mb-4 bg-green-900/30 border border-green-700/70 text-green-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <span className="text-green-400 text-base">✓</span>
          {basariMesaj}
        </div>
      )}

      {hata && (
        <div className="mb-4 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm flex justify-between items-center">
          <span>Hata: {hata}</span>
          <button onClick={() => setHata(null)} className="text-red-400 hover:text-red-200 ml-4">✕</button>
        </div>
      )}

      {loading && calisanlar.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="text-slate-400 text-sm mt-3">Veriler yükleniyor...</p>
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
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">
            {/* Sol: Çalışanlar */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-100">Çalışanlar</h2>
                <span className="text-xs text-slate-400 bg-slate-800/80 border border-slate-700 px-2.5 py-1 rounded-full">
                  {calisanlar.length} kişi
                </span>
              </div>
              <div className="flex flex-col gap-2.5 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
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
            </div>

            {/* Sağ: Projeler */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-100">Projeler</h2>
                <span className="text-xs text-slate-400 bg-slate-800/80 border border-slate-700 px-2.5 py-1 rounded-full">
                  {projeler.length} proje
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
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

      {/* Mobil: Proje seçim modalı */}
      {ataModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div>
                <h3 className="font-semibold text-slate-100 text-base">
                  {ataModal.ad} {ataModal.soyad}
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Hangi projeye atanacak?</p>
              </div>
              <button
                onClick={() => setAtaModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-1.5">
              {projeler.map((proje) => {
                const zatenAtandi = takipler.find(
                  (t) => t.calisanId === ataModal.id && t.projeId === proje.id
                );
                return (
                  <button
                    key={proje.id}
                    onClick={() => {
                      handleMobileAta(ataModal.id, proje.id);
                      setAtaModal(null);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors text-sm font-medium ${
                      zatenAtandi
                        ? 'bg-emerald-900/30 border border-emerald-700/50 text-emerald-300'
                        : 'bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-transparent hover:border-slate-600'
                    }`}
                  >
                    <span>{proje.ad}</span>
                    {zatenAtandi && (
                      <span className="ml-2 text-emerald-400 text-xs">✓ Atandı</span>
                    )}
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
