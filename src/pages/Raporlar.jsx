import { useState } from 'react';
import { getCalisanlar, getProjeler, getTakipByDateRange, getOdemeler, getTahsilatlar, gunlukUcret, gunlukMaliyet } from '../lib/airtable';
import Spinner from '../components/Spinner';

function bugunStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ayBasiStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function Raporlar() {
  const [baslangic, setBaslangic] = useState(ayBasiStr());
  const [bitis, setBitis] = useState(bugunStr());
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState(null);
  const [projeRapor, setProjeRapor] = useState([]);
  const [calisanRapor, setCalisanRapor] = useState([]);
  const [aramaYapildi, setAramaYapildi] = useState(false);

  async function raporOlustur() {
    if (!baslangic || !bitis) return;
    setLoading(true);
    setHata(null);
    setAramaYapildi(false);
    try {
      const [calisanlar, projeler, takipler, odemeler, tahsilatlar] = await Promise.all([
        getCalisanlar(),
        getProjeler(),
        getTakipByDateRange(baslangic, bitis),
        getOdemeler(),
        getTahsilatlar(),
      ]);

      const calisanMap = Object.fromEntries(calisanlar.map((c) => [c.id, c]));
      const projeMap = Object.fromEntries(projeler.map((p) => [p.id, p]));

      // Tüm zamanların ödemeleri — çalışan bazında topla
      const odemeByCalisan = {};
      for (const o of odemeler) {
        if (o.calisanId) {
          odemeByCalisan[o.calisanId] = (odemeByCalisan[o.calisanId] || 0) + (o.tutar || 0);
        }
      }

      // Tüm zamanların tahsilatları — proje bazında topla
      const tahsilatByProje = {};
      for (const t of tahsilatlar) {
        if (t.projeId) {
          tahsilatByProje[t.projeId] = (tahsilatByProje[t.projeId] || 0) + (t.tutar || 0);
        }
      }

      // Proje bazlı rapor (seçili tarih aralığı)
      const projeStats = {};
      for (const t of takipler) {
        if (!t.projeId || !t.calisanId) continue;
        if (!projeStats[t.projeId]) {
          projeStats[t.projeId] = { gunler: 0, ucret: 0, maliyet: 0 };
        }
        projeStats[t.projeId].gunler += 1;
        const calisan = calisanMap[t.calisanId];
        if (calisan) {
          projeStats[t.projeId].ucret += gunlukUcret(calisan.maas);
          projeStats[t.projeId].maliyet += gunlukMaliyet(calisan.maas);
        }
      }

      const projeRaporData = Object.entries(projeStats)
        .map(([projeId, stats]) => ({
          projeId,
          proje: projeMap[projeId] || { ad: 'Bilinmiyor', musteri: '' },
          ...stats,
          kalanAlacak: stats.maliyet - (tahsilatByProje[projeId] || 0),
        }))
        .sort((a, b) => b.gunler - a.gunler);

      // Çalışan bazlı rapor (seçili tarih aralığı)
      const calisanStats = {};
      for (const t of takipler) {
        if (!t.calisanId) continue;
        if (!calisanStats[t.calisanId]) {
          calisanStats[t.calisanId] = { gunler: 0, ucret: 0, maliyet: 0 };
        }
        calisanStats[t.calisanId].gunler += 1;
        const calisan = calisanMap[t.calisanId];
        if (calisan) {
          calisanStats[t.calisanId].ucret += gunlukUcret(calisan.maas);
          calisanStats[t.calisanId].maliyet += gunlukMaliyet(calisan.maas);
        }
      }

      const calisanRaporData = Object.entries(calisanStats)
        .map(([calisanId, stats]) => ({
          calisanId,
          calisan: calisanMap[calisanId] || { ad: 'Bilinmiyor', soyad: '', lakap: '', maas: 0 },
          ...stats,
          kalanBorc: stats.ucret - (odemeByCalisan[calisanId] || 0),
        }))
        .sort((a, b) => b.gunler - a.gunler);

      setProjeRapor(projeRaporData);
      setCalisanRapor(calisanRaporData);
      setAramaYapildi(true);
    } catch (e) {
      setHata(e.message);
    } finally {
      setLoading(false);
    }
  }

  const toplamGun = calisanRapor.reduce((s, r) => s + r.gunler, 0);
  const toplamUcret = calisanRapor.reduce((s, r) => s + r.ucret, 0);
  const toplamMaliyet = calisanRapor.reduce((s, r) => s + r.maliyet, 0);
  const toplamProjeMaliyeti = projeRapor.reduce((s, r) => s + r.maliyet, 0);
  const toplamCalisanUcret = calisanRapor.reduce((s, r) => s + r.ucret, 0);
  const toplamKalanAlacak = projeRapor.reduce((s, r) => s + r.kalanAlacak, 0);
  const toplamKalanBorc = calisanRapor.reduce((s, r) => s + r.kalanBorc, 0);

  function kalanAlacakRenk(deger) {
    if (deger < 0) return 'text-red-400';
    return 'text-emerald-400';
  }

  function kalanBorcRenk(deger) {
    if (deger < 0) return 'text-red-400';
    if (deger > 0) return 'text-amber-400';
    return 'text-slate-400';
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Raporlar</h1>
        <p className="text-slate-400 text-sm mt-1">
          Tarih aralığına göre proje ve çalışan raporları
        </p>
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
          {/* Genel Özet Kartlar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{projeRapor.length}</p>
              <p className="text-slate-400 text-xs mt-1">Aktif Proje</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{toplamGun}</p>
              <p className="text-slate-400 text-xs mt-1">Toplam İşçi-Gün</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-emerald-400">{toplamUcret.toLocaleString('tr-TR')} ₺</p>
              <p className="text-slate-400 text-xs mt-1">Toplam Çalışan Ücreti</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-purple-400">{toplamMaliyet.toLocaleString('tr-TR')} ₺</p>
              <p className="text-slate-400 text-xs mt-1">Toplam Firma Maliyeti</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className={`text-lg font-bold ${calisanRapor.length > 0 ? 'text-slate-300' : 'text-slate-500'}`}>
                {calisanRapor.length}
              </p>
              <p className="text-slate-400 text-xs mt-1">Çalışan Sayısı</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Projeler */}
            <div>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">Projeler</h2>

              {/* Özet Kartlar */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-800 border border-purple-500/30 rounded-xl p-4">
                  <p className="text-xl font-bold text-purple-400">
                    {toplamProjeMaliyeti.toLocaleString('tr-TR')} ₺
                  </p>
                  <p className="text-slate-400 text-xs mt-1">Toplam Firma Maliyeti</p>
                </div>
                <div className="bg-slate-800 border border-slate-600 rounded-xl p-4">
                  <p className={`text-xl font-bold ${kalanAlacakRenk(toplamKalanAlacak)}`}>
                    {toplamKalanAlacak.toLocaleString('tr-TR')} ₺
                  </p>
                  <p className="text-slate-400 text-xs mt-1">Toplam Kalan Alacak</p>
                </div>
              </div>

              {projeRapor.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
                  <p className="text-slate-500">Bu tarih aralığında kayıt bulunamadı</p>
                </div>
              ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[420px]">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-700/50">
                        <th className="text-left px-4 py-3 text-slate-300 font-medium">Proje</th>
                        <th className="text-right px-3 py-3 text-slate-300 font-medium whitespace-nowrap">İşçi-Gün</th>
                        <th className="text-right px-3 py-3 text-purple-400 font-medium whitespace-nowrap">Firma Maliyeti</th>
                        <th className="text-right px-3 py-3 text-slate-300 font-medium whitespace-nowrap">Kalan Alacak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projeRapor.map((r, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-slate-100 font-medium flex items-center gap-1.5">
                              {r.proje.ad}
                              {r.proje.aktif === false && (
                                <span className="text-slate-500 text-xs font-normal">(Pasif)</span>
                              )}
                            </p>
                            {r.proje.musteri && <p className="text-slate-500 text-xs">{r.proje.musteri}</p>}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-blue-400 font-semibold">{r.gunler}</span>
                            <span className="text-slate-500 text-xs ml-1">gün</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-purple-400 font-semibold">{r.maliyet.toLocaleString('tr-TR')} ₺</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className={`font-semibold ${kalanAlacakRenk(r.kalanAlacak)}`}>
                              {r.kalanAlacak.toLocaleString('tr-TR')} ₺
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-700/50">
                        <td className="px-4 py-3 text-slate-300 font-semibold">Toplam</td>
                        <td className="px-3 py-3 text-right text-blue-300 font-bold">
                          {projeRapor.reduce((s, r) => s + r.gunler, 0)} gün
                        </td>
                        <td className="px-3 py-3 text-right text-purple-300 font-bold">
                          {toplamProjeMaliyeti.toLocaleString('tr-TR')} ₺
                        </td>
                        <td className={`px-3 py-3 text-right font-bold ${kalanAlacakRenk(toplamKalanAlacak)}`}>
                          {toplamKalanAlacak.toLocaleString('tr-TR')} ₺
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )}
            </div>

            {/* Çalışanlar */}
            <div>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">Çalışanlar</h2>

              {/* Özet Kartlar */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-4">
                  <p className="text-xl font-bold text-emerald-400">
                    {toplamCalisanUcret.toLocaleString('tr-TR')} ₺
                  </p>
                  <p className="text-slate-400 text-xs mt-1">Toplam Hak Edilen Ücret</p>
                </div>
                <div className="bg-slate-800 border border-slate-600 rounded-xl p-4">
                  <p className={`text-xl font-bold ${kalanBorcRenk(toplamKalanBorc)}`}>
                    {toplamKalanBorc.toLocaleString('tr-TR')} ₺
                  </p>
                  <p className="text-slate-400 text-xs mt-1">Toplam Kalan Borç</p>
                </div>
              </div>

              {calisanRapor.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
                  <p className="text-slate-500">Bu tarih aralığında kayıt bulunamadı</p>
                </div>
              ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[420px]">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-700/50">
                        <th className="text-left px-4 py-3 text-slate-300 font-medium">Çalışan</th>
                        <th className="text-right px-3 py-3 text-slate-300 font-medium whitespace-nowrap">Gün</th>
                        <th className="text-right px-3 py-3 text-emerald-400 font-medium whitespace-nowrap">Hak Ettiği Ücret</th>
                        <th className="text-right px-3 py-3 text-slate-300 font-medium whitespace-nowrap">Kalan Borç</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calisanRapor.map((r, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-slate-100 font-medium flex items-center gap-1.5">
                              {r.calisan.ad} {r.calisan.soyad}
                              {r.calisan.aktif === false && (
                                <span className="text-slate-500 text-xs font-normal">(Pasif)</span>
                              )}
                            </p>
                            {r.calisan.lakap && <p className="text-slate-500 text-xs">"{r.calisan.lakap}"</p>}
                            <p className="text-slate-600 text-xs mt-0.5">
                              {gunlukUcret(r.calisan.maas).toLocaleString('tr-TR')} ₺/gün
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-yellow-400 font-semibold">{r.gunler}</span>
                            <span className="text-slate-500 text-xs ml-1">gün</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-emerald-400 font-semibold">{r.ucret.toLocaleString('tr-TR')} ₺</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className={`font-semibold ${kalanBorcRenk(r.kalanBorc)}`}>
                              {r.kalanBorc.toLocaleString('tr-TR')} ₺
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-700/50">
                        <td className="px-4 py-3 text-slate-300 font-semibold">Toplam</td>
                        <td className="px-3 py-3 text-right text-yellow-300 font-bold">{toplamGun} gün</td>
                        <td className="px-3 py-3 text-right text-emerald-300 font-bold">
                          {toplamCalisanUcret.toLocaleString('tr-TR')} ₺
                        </td>
                        <td className={`px-3 py-3 text-right font-bold ${kalanBorcRenk(toplamKalanBorc)}`}>
                          {toplamKalanBorc.toLocaleString('tr-TR')} ₺
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !aramaYapildi && !hata && (
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <p className="text-slate-500 text-4xl mb-3">📊</p>
            <p className="text-slate-400">Tarih aralığı seçip "Rapor Oluştur" butonuna tıklayın</p>
          </div>
        </div>
      )}
    </div>
  );
}
