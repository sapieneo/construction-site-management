import { useState, useEffect } from 'react';
import {
  getCalisanlar, getProjeler, getTakipByDateRange,
  getOdemeler, createOdeme, gunlukUcret,
} from '../lib/airtable';
import Spinner from '../components/Spinner';
import KayitFormModal from '../components/KayitFormModal';

const PROJE_RENKLER = [
  { cel: 'bg-blue-600/20 border-blue-500/40 text-blue-200', dot: 'bg-blue-500', legend: 'bg-blue-600/20 text-blue-300 border-blue-500/40' },
  { cel: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-200', dot: 'bg-emerald-500', legend: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40' },
  { cel: 'bg-violet-600/20 border-violet-500/40 text-violet-200', dot: 'bg-violet-500', legend: 'bg-violet-600/20 text-violet-300 border-violet-500/40' },
  { cel: 'bg-amber-500/20 border-amber-400/40 text-amber-200', dot: 'bg-amber-400', legend: 'bg-amber-500/20 text-amber-300 border-amber-400/40' },
  { cel: 'bg-rose-600/20 border-rose-500/40 text-rose-200', dot: 'bg-rose-500', legend: 'bg-rose-600/20 text-rose-300 border-rose-500/40' },
  { cel: 'bg-cyan-600/20 border-cyan-500/40 text-cyan-200', dot: 'bg-cyan-500', legend: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40' },
  { cel: 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200', dot: 'bg-indigo-500', legend: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40' },
  { cel: 'bg-teal-600/20 border-teal-500/40 text-teal-200', dot: 'bg-teal-500', legend: 'bg-teal-600/20 text-teal-300 border-teal-500/40' },
];

const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const days = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function toDateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatTarih(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function Avatar({ calisan }) {
  const bas = `${calisan.ad?.[0] || ''}${calisan.soyad?.[0] || ''}`.toUpperCase();
  if (calisan.resimUrl) {
    return <img src={calisan.resimUrl} alt={bas} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  }
  const RENKLER = ['bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];
  let hash = 0;
  for (let i = 0; i < (calisan.ad + calisan.soyad).length; i++) {
    hash = (calisan.ad + calisan.soyad).charCodeAt(i) + ((hash << 5) - hash);
  }
  const renk = RENKLER[Math.abs(hash) % RENKLER.length];
  return (
    <div className={`w-8 h-8 rounded-full ${renk} flex items-center justify-center text-xs font-semibold text-white flex-shrink-0`}>
      {bas}
    </div>
  );
}

export default function CalisanTakvimi() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calisanlar, setCalisanlar] = useState([]);
  const [projeler, setProjeler] = useState([]);
  const [secilenId, setSecilenId] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [odemeler, setOdemeler] = useState([]);
  const [odemeYukluyor, setOdemeYukluyor] = useState(false);
  const [odemeModal, setOdemeModal] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingTakvim, setLoadingTakvim] = useState(false);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const [c, p] = await Promise.all([getCalisanlar(), getProjeler()]);
        setCalisanlar(c);
        setProjeler(p);
      } catch (e) {
        setHata(e.message);
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, []);

  // Takvim verisi: seçili çalışan + ay değişince yenile
  useEffect(() => {
    if (!secilenId) return;
    async function load() {
      setLoadingTakvim(true);
      try {
        const baslangic = toDateStr(year, month, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        const bitis = toDateStr(year, month, daysInMonth);
        const takipler = await getTakipByDateRange(baslangic, bitis);
        const map = {};
        for (const t of takipler) {
          if (t.calisanId === secilenId && t.tarih) {
            map[t.tarih] = t.projeId;
          }
        }
        setAssignments(map);
      } catch (e) {
        setHata(e.message);
      } finally {
        setLoadingTakvim(false);
      }
    }
    load();
  }, [secilenId, year, month]);

  // Ödemeler: sadece çalışan değişince yenile (tüm zamanlar)
  useEffect(() => {
    if (!secilenId) { setOdemeler([]); return; }
    async function loadOdemeler() {
      setOdemeYukluyor(true);
      try {
        const data = await getOdemeler(secilenId);
        setOdemeler(data);
      } catch (e) {
        setHata(e.message);
      } finally {
        setOdemeYukluyor(false);
      }
    }
    loadOdemeler();
  }, [secilenId]);

  const projeRenkMap = Object.fromEntries(
    projeler.map((p, i) => [p.id, PROJE_RENKLER[i % PROJE_RENKLER.length]])
  );
  const projeAdMap = Object.fromEntries(projeler.map((p) => [p.id, p.ad]));

  const calendarDays = buildCalendarDays(year, month);
  const secilenCalisan = calisanlar.find((c) => c.id === secilenId);

  const toplamCalisma = Object.keys(assignments).length;
  const gunUcret = gunlukUcret(secilenCalisan?.maas);
  const toplamHakEdilen = toplamCalisma * gunUcret;
  const toplamOdeme = odemeler.reduce((s, o) => s + (o.tutar || 0), 0);
  const kalanBorc = toplamHakEdilen - toplamOdeme;

  const aktifProjeler = projeler.filter((p) =>
    Object.values(assignments).includes(p.id)
  );

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  async function handleOdemeEkle({ tarih, tutar, aciklama }) {
    const yeniOdeme = await createOdeme({ calisanId: secilenId, tarih, tutar, aciklama });
    setOdemeler((prev) => [yeniOdeme, ...prev]);
  }

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-slate-400 text-sm mt-3">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sy-page-head" style={{ marginBottom: 24 }}>
        <div>
          <h1>Çalışan Takvimi</h1>
          <p style={{ marginTop: 6, color: 'var(--ink-mute)', fontSize: 13 }}>Aylık proje atama görünümü</p>
        </div>
      </div>

      {hata && (
        <div className="mb-4 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm flex justify-between items-center">
          <span>Hata: {hata}</span>
          <button onClick={() => setHata(null)} className="text-red-400 hover:text-red-200 ml-4">✕</button>
        </div>
      )}

      <div className="sy-board">
        {/* Sol: Çalışan listesi */}
        <aside className="sy-worker-panel">
          <div className="sy-worker-panel__head">
            <div className="sy-worker-panel__title">
              <h3>👷 Çalışanlar</h3>
              <span className="sy-worker-panel__count">{calisanlar.length} kişi</span>
            </div>
          </div>
          <div className="sy-worker-list">
            {calisanlar.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSecilenId(c.id); setAssignments({}); setOdemeler([]); }}
                className="sy-worker"
                style={{
                  background: secilenId === c.id ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : undefined,
                  border: secilenId === c.id ? '1px solid var(--accent-ring)' : '1px solid transparent',
                  cursor: 'pointer',
                  width: '100%', textAlign: 'left',
                }}
              >
                <Avatar calisan={c} />
                <div className="sy-worker__info">
                  <b style={{ color: secilenId === c.id ? 'var(--accent-bright)' : 'var(--ink)' }}>
                    {c.ad} {c.soyad}
                    {c.aktif === false && <span style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 4 }}>(Pasif)</span>}
                  </b>
                  <div className="sy-worker__role">
                    {c.rol || (c.lakap ? `"${c.lakap}"` : '')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Sağ: Takvim + Ödemeler */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {!secilenId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 48, marginBottom: 12 }}>📅</p>
                <p style={{ color: 'var(--ink-mute)', fontSize: 14 }}>Sol taraftan bir çalışan seçin</p>
              </div>
            </div>
          ) : (
            <>
              {/* Takvim kartı */}
              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                {/* Ay navigasyonu */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <button
                    onClick={prevMonth}
                    className="sy-icon-btn"
                    style={{ fontSize: 20 }}
                  >
                    ‹
                  </button>
                  <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                        {AYLAR[month - 1]} {year}
                      </h3>
                      {secilenCalisan && (
                        <p className="text-slate-400 text-xs flex items-center justify-center gap-1.5">
                          {secilenCalisan.ad} {secilenCalisan.soyad}
                          {secilenCalisan.aktif === false && (
                            <span className="text-slate-600">(Pasif)</span>
                          )}
                        </p>
                      )}
                    </div>
                    {loadingTakvim && <Spinner size="sm" />}
                  </div>
                  <button
                    onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors text-lg"
                  >
                    ›
                  </button>
                </div>

                {/* Takvim grid */}
                <div className="p-4">
                  <div className="grid grid-cols-7 mb-2">
                    {GUNLER.map((g) => (
                      <div key={g} className="text-center text-xs font-medium text-slate-500 py-1">
                        {g}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarDays.map((day, idx) => {
                      if (!day) return <div key={`empty-${idx}`} className="min-h-[44px] sm:min-h-[62px]" />;
                      const dateKey = toDateStr(year, month, day);
                      const projeId = assignments[dateKey];
                      const renk = projeId ? projeRenkMap[projeId] : null;
                      const projeAd = projeId ? projeAdMap[projeId] : null;
                      return (
                        <div
                          key={dateKey}
                          className={`rounded-lg p-1 sm:p-2 min-h-[44px] sm:min-h-[62px] border text-xs flex flex-col transition-all ${
                            renk ? renk.cel : 'bg-slate-700/20 border-slate-700/30'
                          }`}
                        >
                          <span className={`font-semibold text-xs sm:text-sm mb-0.5 leading-none ${renk ? '' : 'text-slate-600'}`}>
                            {day}
                          </span>
                          {projeAd && (
                            <span className="leading-tight font-medium hidden sm:block" style={{ fontSize: '10px' }}>
                              {projeAd.length > 14 ? projeAd.slice(0, 14) + '…' : projeAd}
                            </span>
                          )}
                          {projeAd && (
                            <span className="sm:hidden w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ background: 'currentColor' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Renk açıklaması */}
                {aktifProjeler.length > 0 && (
                  <div className="px-5 pb-4 flex flex-wrap gap-2">
                    {aktifProjeler.map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${projeRenkMap[p.id]?.legend}`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${projeRenkMap[p.id]?.dot}`} />
                        {p.ad}
                      </div>
                    ))}
                  </div>
                )}

                {/* Ay özeti */}
                <div className="px-5 py-5 bg-slate-700/20 border-t border-slate-700/60">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-3xl font-bold text-blue-400">{toplamCalisma}</p>
                      <p className="text-slate-400 text-xs mt-0.5">Çalışma günü ({AYLAR[month - 1]})</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-emerald-400">
                        {toplamHakEdilen.toLocaleString('tr-TR')} ₺
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">Hak ettiği ücret</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ödemeler kartı */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl overflow-hidden backdrop-blur-sm shadow-md shadow-slate-950/50">
                {/* Başlık */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
                  <div>
                    <h3 className="font-semibold text-slate-100 text-sm">Ödemeler</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Tüm zamanlar</p>
                  </div>
                  <button
                    onClick={() => setOdemeModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                  >
                    <span className="font-bold text-base leading-none">+</span>
                    Ödeme Ekle
                  </button>
                </div>

                {/* Özet: hak edilen / ödenen / kalan */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 px-3 sm:px-5 py-4 sm:py-5 border-b border-slate-700/50">
                  <div>
                    <p className="text-sm sm:text-lg font-bold text-emerald-400">
                      {toplamHakEdilen.toLocaleString('tr-TR')} ₺
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">Bu ay hak ettiği</p>
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-bold text-blue-400">
                      {toplamOdeme.toLocaleString('tr-TR')} ₺
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">Toplam ödenen</p>
                  </div>
                  <div>
                    <p className={`text-sm sm:text-lg font-bold ${kalanBorc > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {kalanBorc.toLocaleString('tr-TR')} ₺
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {kalanBorc > 0 ? 'Kalan borç' : kalanBorc < 0 ? 'Fazla ödendi' : 'Borç yok'}
                    </p>
                  </div>
                </div>

                {/* Ödemeler listesi */}
                {odemeYukluyor ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner />
                  </div>
                ) : odemeler.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-slate-600 text-sm">Henüz ödeme kaydı yok</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/50 bg-slate-700/30">
                          <th className="text-left px-5 py-2.5 text-slate-400 font-medium text-xs">Tarih</th>
                          <th className="text-right px-5 py-2.5 text-emerald-500 font-medium text-xs">Tutar</th>
                          <th className="text-left px-5 py-2.5 text-slate-400 font-medium text-xs">Açıklama</th>
                        </tr>
                      </thead>
                      <tbody>
                        {odemeler.map((o) => (
                          <tr key={o.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                            <td className="px-5 py-2.5 text-slate-300 whitespace-nowrap">{formatTarih(o.tarih)}</td>
                            <td className="px-5 py-2.5 text-right text-emerald-400 font-semibold whitespace-nowrap">
                              {o.tutar.toLocaleString('tr-TR')} ₺
                            </td>
                            <td className="px-5 py-2.5 text-slate-500 text-xs">{o.aciklama || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-700/30">
                          <td className="px-5 py-2.5 text-slate-300 font-semibold text-xs">Toplam</td>
                          <td className="px-5 py-2.5 text-right text-emerald-300 font-bold">
                            {toplamOdeme.toLocaleString('tr-TR')} ₺
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ödeme ekleme modalı */}
      {odemeModal && (
        <KayitFormModal
          baslik={`Ödeme Ekle — ${secilenCalisan?.ad} ${secilenCalisan?.soyad}`}
          onKaydet={handleOdemeEkle}
          onKapat={() => setOdemeModal(false)}
        />
      )}
    </div>
  );
}
