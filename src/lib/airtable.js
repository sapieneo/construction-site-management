const TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN;
const BASE_ID = import.meta.env.VITE_BASE_ID;

const TABLE_IDS = {
  projeler: 'tbltRmgvvrHVAg1QP',
  calisanlar: 'tblnM0liFe7fWZVrM',
  takip: 'tblNGG3HtRSXArgT7',
  odemeler: 'tbliAB6WeiuXeMRKL',
  tahsilatlar: 'tblS0lNcxnt7veGib',
};

const FIELDS = {
  calisanlar: {
    ad: 'fld7JGCCoklbJ980D',
    soyad: 'fldn8sMv51Ryx9G8b',
    lakap: 'fldvaadKq5607A6Iw',
    maas: 'fldTDBPjOcFIvAktd',
    rol: 'fldXLnVhpZr8Q0ray',
    resim: 'fld3ilXRKbmiGek5U',
    aktifPasif: 'fld4B5AkKSHhFzVNZ',
  },
  projeler: {
    ad: 'fld4KXANFZCzU9fVt',
    musteri: 'fld8NUy6ipzTydb0X',
    aktifPasif: 'fldAauXSd7ZCFHU4K',
  },
  takip: {
    kayitAd: 'fldRlaNXKV0t59o4F',
    tarih: 'fldsdGoYIXvpZGLFp',
    calisan: 'fldHwe1DK8PZWn66N',
    proje: 'fldAhuBeciRZJ14WL',
  },
  odemeler: {
    odemeAd: 'fldo7o4ARkd3w1cfB',
    calisan: 'fldp03YOwBwyfS9FT',
    tarih: 'fldG7zqi8AlO4hUIR',
    tutar: 'fldmsQaKSVQFdUbiO',
    aciklama: 'fldybgp1Y4Mowj2oU',
  },
  tahsilatlar: {
    tahsilatAd: 'fldpxyPe0MvIrZ1Tj',
    proje: 'fldxqUoPZPcsTj6a0',
    tarih: 'fldKIIxtqwNzyPMnF',
    tutar: 'fldxCZQ9GxzY9qvyi',
    aciklama: 'fld8msJrUSp4ijte9',
  },
};

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// Linked record alanı hem ["recXXX"] hem de [{id:"recXXX"}] formatında gelebilir
function linkedId(field) {
  const first = (field || [])[0];
  if (!first) return null;
  return typeof first === 'object' ? first.id : first;
}

function buildUrl(tableId, params = {}) {
  const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach((item) => url.searchParams.append(k, item));
    } else {
      url.searchParams.set(k, v);
    }
  });
  return url.toString();
}

async function fetchAll(tableId, params = {}) {
  let records = [];
  let offset = null;
  do {
    const p = offset
      ? { returnFieldsByFieldId: 'true', ...params, offset }
      : { returnFieldsByFieldId: 'true', ...params };
    const res = await fetch(buildUrl(tableId, p), { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    records = records.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);
  return records;
}

function mapCalisan(r) {
  return {
    id: String(r.id),
    ad: r.fields[FIELDS.calisanlar.ad] || '',
    soyad: r.fields[FIELDS.calisanlar.soyad] || '',
    lakap: r.fields[FIELDS.calisanlar.lakap] || '',
    maas: r.fields[FIELDS.calisanlar.maas] || 0,
    rol: r.fields[FIELDS.calisanlar.rol] || '',
    resimUrl: (r.fields[FIELDS.calisanlar.resim] || [])[0]?.thumbnails?.small?.url || null,
    aktif: r.fields[FIELDS.calisanlar.aktifPasif] !== 'Pasif',
  };
}

function mapProje(r) {
  return {
    id: String(r.id),
    ad: r.fields[FIELDS.projeler.ad] || '',
    musteri: r.fields[FIELDS.projeler.musteri] || '',
    aktif: r.fields[FIELDS.projeler.aktifPasif] !== 'Pasif',
  };
}

// Tüm çalışanlar — raporlar için (aktif/pasif bilgisiyle)
export async function getCalisanlar() {
  const records = await fetchAll(TABLE_IDS.calisanlar);
  return records.map(mapCalisan);
}

// Sadece aktif çalışanlar — Görevlendirme için (Pasif olmayanlar)
export async function getCalisanlarAktif() {
  const records = await fetchAll(TABLE_IDS.calisanlar);
  return records
    .filter((r) => r.fields[FIELDS.calisanlar.aktifPasif] !== 'Pasif')
    .map(mapCalisan);
}

// Tüm projeler — raporlar için (aktif/pasif bilgisiyle)
export async function getProjeler() {
  const records = await fetchAll(TABLE_IDS.projeler);
  return records.map(mapProje);
}

// Sadece aktif projeler — Görevlendirme için (Pasif olmayanlar)
export async function getProjelerAktif() {
  const records = await fetchAll(TABLE_IDS.projeler);
  return records
    .filter((r) => r.fields[FIELDS.projeler.aktifPasif] !== 'Pasif')
    .map(mapProje);
}

export async function getTakipByTarih(tarih) {
  // filterByFormula ile date field ID'si çalışmıyor; tümünü çekip JS'de filtrele
  const records = await fetchAll(TABLE_IDS.takip);
  return records
    .filter((r) => (r.fields[FIELDS.takip.tarih] || '') === tarih)
    .map((r) => ({
      id: r.id,
      kayitAd: r.fields[FIELDS.takip.kayitAd] || '',
      tarih: r.fields[FIELDS.takip.tarih] || '',
      calisanId: linkedId(r.fields[FIELDS.takip.calisan]),
      projeId: linkedId(r.fields[FIELDS.takip.proje]),
    }));
}

export async function getTakipByDateRange(baslangic, bitis) {
  // baslangic, bitis: "YYYY-MM-DD" — tümünü çekip JS'de filtrele
  const records = await fetchAll(TABLE_IDS.takip);
  return records
    .filter((r) => {
      const t = r.fields[FIELDS.takip.tarih] || '';
      return t >= baslangic && t <= bitis;
    })
    .map((r) => ({
      id: r.id,
      kayitAd: r.fields[FIELDS.takip.kayitAd] || '',
      tarih: r.fields[FIELDS.takip.tarih] || '',
      calisanId: linkedId(r.fields[FIELDS.takip.calisan]),
      projeId: linkedId(r.fields[FIELDS.takip.proje]),
    }));
}

// Tüm ödemeler — isteğe bağlı calisanId ile filtrele
export async function getOdemeler(calisanId = null) {
  const records = await fetchAll(TABLE_IDS.odemeler);
  return records
    .filter((r) => !calisanId || linkedId(r.fields[FIELDS.odemeler.calisan]) === calisanId)
    .map((r) => ({
      id: r.id,
      tarih: r.fields[FIELDS.odemeler.tarih] || '',
      tutar: r.fields[FIELDS.odemeler.tutar] || 0,
      aciklama: r.fields[FIELDS.odemeler.aciklama] || '',
      calisanId: linkedId(r.fields[FIELDS.odemeler.calisan]),
    }))
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
}

// Tüm tahsilatlar — isteğe bağlı projeId ile filtrele
export async function getTahsilatlar(projeId = null) {
  const records = await fetchAll(TABLE_IDS.tahsilatlar);
  return records
    .filter((r) => !projeId || linkedId(r.fields[FIELDS.tahsilatlar.proje]) === projeId)
    .map((r) => ({
      id: r.id,
      tarih: r.fields[FIELDS.tahsilatlar.tarih] || '',
      tutar: r.fields[FIELDS.tahsilatlar.tutar] || 0,
      aciklama: r.fields[FIELDS.tahsilatlar.aciklama] || '',
      projeId: linkedId(r.fields[FIELDS.tahsilatlar.proje]),
    }))
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
}

export async function createOdeme({ calisanId, tarih, tutar, aciklama }) {
  const body = {
    records: [{
      fields: {
        [FIELDS.odemeler.odemeAd]: `Ödeme - ${tarih}`,
        [FIELDS.odemeler.calisan]: [String(calisanId)],
        [FIELDS.odemeler.tarih]: tarih,
        [FIELDS.odemeler.tutar]: Number(tutar),
        ...(aciklama ? { [FIELDS.odemeler.aciklama]: aciklama } : {}),
      },
    }],
  };
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_IDS.odemeler}`,
    { method: 'POST', headers, body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return {
    id: data.records[0].id,
    tarih,
    tutar: Number(tutar),
    aciklama: aciklama || '',
    calisanId: String(calisanId),
  };
}

export async function createTahsilat({ projeId, tarih, tutar, aciklama }) {
  const body = {
    records: [{
      fields: {
        [FIELDS.tahsilatlar.tahsilatAd]: `Tahsilat - ${tarih}`,
        [FIELDS.tahsilatlar.proje]: [String(projeId)],
        [FIELDS.tahsilatlar.tarih]: tarih,
        [FIELDS.tahsilatlar.tutar]: Number(tutar),
        ...(aciklama ? { [FIELDS.tahsilatlar.aciklama]: aciklama } : {}),
      },
    }],
  };
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_IDS.tahsilatlar}`,
    { method: 'POST', headers, body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return {
    id: data.records[0].id,
    tarih,
    tutar: Number(tutar),
    aciklama: aciklama || '',
    projeId: String(projeId),
  };
}

export async function createTakipKaydi({ tarih, calisanId, projeId, kayitAd }) {
  const body = {
    records: [
      {
        fields: {
          [FIELDS.takip.kayitAd]: kayitAd,
          [FIELDS.takip.tarih]: tarih,
          [FIELDS.takip.calisan]: [String(calisanId)],
          [FIELDS.takip.proje]: [String(projeId)],
        },
      },
    ],
  };
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_IDS.takip}?returnFieldsByFieldId=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  return {
    id: data.records[0].id,
    kayitAd,
    tarih,
    calisanId: String(calisanId),
    projeId: String(projeId),
  };
}

export async function deleteTakipKaydi(recordId) {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_IDS.takip}/${recordId}`,
    { method: 'DELETE', headers }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
}

export async function deleteTakipKayitlariBatch(recordIds) {
  for (let i = 0; i < recordIds.length; i += 10) {
    const chunk = recordIds.slice(i, i + 10);
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_IDS.takip}`);
    chunk.forEach((id) => url.searchParams.append('records[]', id));
    const res = await fetch(url.toString(), { method: 'DELETE', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
  }
}

export async function createTakipKayitlariBatch(kayitlar) {
  const results = [];
  for (let i = 0; i < kayitlar.length; i += 10) {
    const chunk = kayitlar.slice(i, i + 10);
    const body = {
      records: chunk.map((k) => {
        const fields = {
          [FIELDS.takip.kayitAd]: k.kayitAd,
          [FIELDS.takip.tarih]: k.tarih,
          [FIELDS.takip.calisan]: [String(k.calisanId)],
        };
        if (k.projeId) {
          fields[FIELDS.takip.proje] = [String(k.projeId)];
        }
        return { fields };
      }),
    };
    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_IDS.takip}?returnFieldsByFieldId=true`,
      { method: 'POST', headers, body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `HTTP ${res.status}`);
    }
    data.records.forEach((r, idx) => {
      results.push({
        id: r.id,
        kayitAd: chunk[idx].kayitAd,
        tarih: chunk[idx].tarih,
        calisanId: String(chunk[idx].calisanId),
        projeId: String(chunk[idx].projeId),
      });
    });
  }
  return results;
}

async function patchRecord(tableId, recordId, fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}?returnFieldsByFieldId=true`,
    { method: 'PATCH', headers, body: JSON.stringify({ fields }) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
}

export async function pasifCalisanAl(recordId) {
  return patchRecord(TABLE_IDS.calisanlar, recordId, {
    [FIELDS.calisanlar.aktifPasif]: 'Pasif',
  });
}

export async function pasifProjeAl(recordId) {
  return patchRecord(TABLE_IDS.projeler, recordId, {
    [FIELDS.projeler.aktifPasif]: 'Pasif',
  });
}

// Günlük çalışan ücreti: aylık maaş / 30
export function gunlukUcret(aylikMaas) {
  return Math.round((aylikMaas || 0) / 30);
}

// Günlük firma maliyeti: (aylık maaş / 30) + 1000 TL yemek/yatak
export function gunlukMaliyet(aylikMaas) {
  return gunlukUcret(aylikMaas) + 1000;
}

export function formatTarih(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export function toISODate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function yarin() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}
