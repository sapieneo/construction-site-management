import { useState } from 'react';
import {
  getCalisanlar, getProjeler, getTakipByDateRange, getTahsilatlar,
  createTahsilat, gunlukMaliyet,
} from '../lib/airtable';
import Spinner from '../components/Spinner';
import KayitFormModal from '../components/KayitFormModal';

function bugunStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ayBasiStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatTarih(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export default function SantiyeRaporu() {
  const [baslangic, setBaslangic] = useState(ayBasiStr());
  const [bitis, setBitis] = useState(bugunStr());
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState(null);
  const [projeRaporlar, setProjeRaporlar] = useState([]);
  const [aramaYapildi, setAramaYapildi] = useState(false);
  const [tahsilatModal, setTahsilatModal] = useState(null); // {projeId, projeAd} | null

  async function raporOlustur() {
    if (!baslangic || !bitis) return;
    setLoading(true);
    setHata(null);
    try {
      const [calisanlar, projeler, takipler, tahsilatlar] = await Promise.all([
        getCalisanlar(),
        getProjeler(),
        getTakipByDateRange(baslangic, bitis),
        getTahsilatlar(),
      ]);

      const calisanMap = Object.fromEntries(calisanlar.map((c) => [c.id, c]));

      // Tahsilatları proje bazında grupla
      const tahsilatMap = {};
      for (const t of tahsilatlar) {
        if (!t.projeId) continue;
        if (!tahsilatMap[t.projeId]) tahsilatMap[t.projeId] = [];
        tahsilatMap[t.projeId].push(t);
      }

      // Her proje için istatistik hazırla
      const projeStats = {};
      for (const proje of projeler) {
        projeStats[proje.id] = {
          proje,
          calisanlar: {},
          toplamGun: 0,
          toplamMaliyet: 0,
          tahsilatlar: (tahsilatMap[proje.id] || []).sort((a, b) => b.tarih.localeCompare(a.tarih)),
        };
      }

      for (const t of takipler) {
        if (!t.projeId || !t.calisanId) continue;
        if (!projeStats[t.projeId]) continue;
        const calisan = calisanMap[t.calisanId];
        const gunMaliyet = gunlukMaliyet(calisan?.maas);

        if (!projeStats[t.projeId].calisanlar[t.calisanId]) {
          projeStats[t.projeId].calisanlar[t.calisanId] = { calisan, gun: 0, maliyet: 0 };
        }
        projeStats[t.projeId].calisanlar[t.calisanId].gun += 1;
        projeStats[t.projeId].calisanlar[t.calisanId].maliyet += gunMaliyet;
        projeStats[t.projeId].toplamGun += 1;
        projeStats[t.projeId].toplamMaliyet += gunMaliyet;
      }

      const raporData = Object.values(projeStats)
        .map((stats) => ({
          ...stats,
          calisanlar: Object.values(stats.calisanlar).sort((a, b) => b.gun - a.gun),
        }))
        .sort((a, b) => b.toplamGun - a.toplamGun);

      setProjeRaporlar(raporData);
      setAramaYapildi(true);
    } catch (e) {
      setHata(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTahsilatEkle({ tarih, tutar, aciklama }) {
    const yeniTahsilat = await createTahsilat({
      projeId: tahsilatModal.projeId,
      tarih,
      tutar,
      aciklama,
    });
    setProjeRaporlar((prev) =>
      prev.map((r) =>
        r.proje.id === tahsilatModal.projeId
          ? { ...r, tahsilatlar: [yeniTahsilat, ...r.tahsilatlar] }
          : r
      )
    );
  }

  const genelToplamGun = projeRaporlar.reduce((s, r) => s + r.toplamGun, 0);
  const genelToplamMaliyet = projeRaporlar.reduce((s, r) => s + r.toplamMaliyet, 0);
  const genelToplamTahsilat = projeRaporlar.reduce(
    (s, r) => s + r.tahsilatlar.reduce((ts, t) => ts + (t.tutar || 0), 0),
    0
  );

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Şantiye Raporu</h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">Proje bazlı işçilik ve maliyet raporu</p>
      </div>

      {/* Tarih Seçici */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 text-sm">Başlangıç Tarihi</label>
            <input
              type="date"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 text-sm">Bitiş Tarihi</label>
            <input
              type="date"
              value={bitis}
              onChange={(e) => setBitis(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={raporOlustur}
            disabled={loading || !baslangic || !bitis}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors"
          >
            {loading && <Spinner size="sm" />}
            Rapor Oluştur
          </button>
        </div>
      </div>

      {hata && (
        <div className="mb-4 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm flex justify-between items-center">
          <span>Hata: {hata}</span>
          <button onClick={() => setHata(null)} className="text-red-400 hover:text-red-200 ml-4">✕</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="text-slate-400 text-sm mt-3">Rapor hazırlanıyor...</p>
          </div>
        </div>
      )}

      {!loading && aramaYapildi && (
        <>
          {/* Genel özet */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{projeRaporlar.filter(r => r.toplamGun > 0).length}</p>
              <p className="text-slate-400 text-xs mt-1">Aktif Proje</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{genelToplamGun}</p>
              <p className="text-slate-400 text-xs mt-1">Toplam İşçi-Gün</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-purple-400">{genelToplamMaliyet.toLocaleString('tr-TR')} ₺</p>
              <p className="text-slate-400 text-xs mt-1">Toplam Firma Maliyeti</p>
            </div>
          </div>

          {/* Proje kartları */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projeRaporlar.map(({ proje, calisanlar, toplamGun, toplamMaliyet, tahsilatlar }) => {
              const toplamTahsilat = tahsilatlar.reduce((s, t) => s + (t.tutar || 0), 0);
              const kalanAlacak = toplamMaliyet - toplamTahsilat;

              return (
                <div key={proje.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                  {/* Kart başlık */}
                  <div className="px-5 py-4 border-b border-slate-700">
                    <h3 className="font-semibold text-slate-100 text-base leading-tight flex items-center gap-2">
                      {proje.ad}
                      {proje.aktif === false && (
                        <span className="text-slate-500 text-xs font-normal">(Pasif)</span>
                      )}
                    </h3>
                    {proje.musteri && (
                      <p className="text-slate-400 text-xs mt-0.5">{proje.musteri}</p>
                    )}
                    <div className="flex gap-4 mt-3 flex-wrap">
                      <div>
                        <p className="text-2xl font-bold text-blue-400">{toplamGun}</p>
                        <p className="text-slate-500 text-xs">işçi-gün</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-purple-400">{toplamMaliyet.toLocaleString('tr-TR')} ₺</p>
                        <p className="text-slate-500 text-xs">firma maliyeti</p>
                      </div>
                    </div>
                  </div>

                  {/* Çalışan listesi */}
                  <div className="flex-1">
                    {calisanlar.length === 0 ? (
                      <div className="flex items-center justify-center py-6">
                        <p className="text-slate-600 text-sm">Bu dönemde atama yok</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-700/40">
                        <div className="grid grid-cols-[1fr_auto_auto] px-5 py-2 text-xs font-medium">
                          <span className="text-slate-500">Çalışan</span>
                          <span className="text-right text-slate-500 mr-3">Gün</span>
                          <span className="text-right text-purple-600">Firma Maliyeti</span>
                        </div>
                        {calisanlar.map(({ calisan, gun, maliyet }) => (
                          <div key={calisan?.id} className="grid grid-cols-[1fr_auto_auto] items-center px-5 py-2.5 hover:bg-slate-700/20 transition-colors">
                            <div className="min-w-0">
                              <p className="text-slate-200 text-sm font-medium flex items-center gap-1.5">
                                <span className="truncate">{calisan?.ad} {calisan?.soyad}</span>
                                {calisan?.aktif === false && (
                                  <span className="text-slate-500 text-xs font-normal flex-shrink-0">(Pasif)</span>
                                )}
                              </p>
                              {calisan?.lakap && (
                                <p className="text-slate-500 text-xs truncate">"{calisan.lakap}"</p>
                              )}
                              <p className="text-slate-600 text-xs mt-0.5">
                                {gunlukMaliyet(calisan?.maas).toLocaleString('tr-TR')} ₺ firma/gün
                              </p>
                            </div>
                            <div className="text-right mr-3">
                              <span className="text-yellow-400 font-semibold text-sm">{gun}</span>
                              <span className="text-slate-600 text-xs ml-0.5">g</span>
                            </div>
                            <div className="text-right">
                              <span className="text-purple-400 text-sm font-medium">
                                {maliyet.toLocaleString('tr-TR')} ₺
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tahsilatlar bölümü */}
                  <div className="border-t border-slate-700">
                    {/* Tahsilat özeti + buton */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-sm font-bold text-emerald-400">
                            {toplamTahsilat.toLocaleString('tr-TR')} ₺
                          </p>
                          <p className="text-slate-600 text-xs">tahsilat</p>
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${kalanAlacak > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {kalanAlacak.toLocaleString('tr-TR')} ₺
                          </p>
                          <p className="text-slate-600 text-xs">
                            {kalanAlacak > 0 ? 'kalan alacak' : kalanAlacak < 0 ? 'fazla tahsilat' : 'tahsilat tamam'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setTahsilatModal({ projeId: proje.id, projeAd: proje.ad })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-800/60 hover:bg-emerald-700 text-emerald-300 transition-colors"
                      >
                        <span className="font-bold">+</span>
                        Tahsilat Ekle
                      </button>
                    </div>

                    {/* Tahsilat listesi */}
                    {tahsilatlar.length === 0 ? (
                      <div className="px-5 py-3">
                        <p className="text-slate-600 text-xs">Henüz tahsilat yok</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-700/30">
                        {tahsilatlar.map((t) => (
                          <div key={t.id} className="flex items-center justify-between px-5 py-2 hover:bg-slate-700/20 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-slate-400 text-xs whitespace-nowrap">{formatTarih(t.tarih)}</span>
                              {t.aciklama && (
                                <span className="text-slate-600 text-xs truncate">{t.aciklama}</span>
                              )}
                            </div>
                            <span className="text-emerald-400 text-sm font-semibold whitespace-nowrap ml-3">
                              {t.tutar.toLocaleString('tr-TR')} ₺
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Alt toplam */}
                  {calisanlar.length > 0 && (
                    <div className="px-5 py-3 bg-slate-700/30 border-t border-slate-700 flex justify-between items-center gap-3 flex-wrap">
                      <span className="text-slate-500 text-xs">{calisanlar.length} çalışan</span>
                      <div className="flex gap-4 text-sm font-semibold">
                        <span className="text-purple-300">
                          {toplamMaliyet.toLocaleString('tr-TR')} ₺{' '}
                          <span className="text-slate-500 font-normal text-xs">firma maliyeti</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && !aramaYapildi && !hata && (
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <p className="text-slate-500 text-4xl mb-3">🏗️</p>
            <p className="text-slate-400">Tarih aralığı seçip "Rapor Oluştur" butonuna tıklayın</p>
          </div>
        </div>
      )}

      {/* Tahsilat ekleme modalı */}
      {tahsilatModal && (
        <KayitFormModal
          baslik={`Tahsilat Ekle — ${tahsilatModal.projeAd}`}
          onKaydet={handleTahsilatEkle}
          onKapat={() => setTahsilatModal(null)}
        />
      )}
    </div>
  );
}
