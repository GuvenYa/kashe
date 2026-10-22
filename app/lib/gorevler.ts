/**
 * FAZ 8a — gorev sozlugu: durum etiketleri, rozet siniflari, aktivite cumlesi ve
 * DB hata eslemesi. TEK KAYNAK.
 *
 * 'use client' YOKTUR: sunucu sayfalari ve istemci listeleri ayni dosyayi okur.
 *
 * ILKE: kurallar veritabaninda (`20261021120000_faz8a_01_gorevler.sql`
 * tetikleyicileri), bu dosya yalniz onlarin ciktisini Turkceye cevirir. Buraya
 * yeni bir KURAL yazilmaz; tetikleyici metni degisirse esleme guncellenir.
 */

// FAZ 8b: firsat asamasi etiketi saf `crm.ts` modulunden (DB erisimi yok).
import { asamaEtiketi } from '@/app/lib/crm';
// FAZ 8c: tedarikci kategorisi ve atama durumu etiketleri (saf modul).
import { durumEtiketi, kategoriEtiketi } from '@/app/lib/tedarikci';

/** `public.task_status` enum sirasi — liste ve secim kutulari bu sirayi izler. */
export const GOREV_DURUMLARI = [
  'todo',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
] as const;

export type GorevDurumu = (typeof GOREV_DURUMLARI)[number];

export const GOREV_DURUM_ETIKETLERI: Record<GorevDurumu, string> = {
  todo: 'Yapılacak',
  in_progress: 'Devam ediyor',
  blocked: 'Engellendi',
  done: 'Tamamlandı',
  cancelled: 'İptal',
};

/** Rozet siniflari — DESIGN.md token'lari; yeni renk eklenmez. */
export const GOREV_DURUM_SINIFLARI: Record<GorevDurumu, string> = {
  todo: 'bg-paper-2 border-line text-ink-72',
  in_progress: 'bg-brand-ink-08 border-brand-ink/25 text-brand-ink',
  blocked: 'bg-danger-08 border-danger/40 text-danger',
  done: 'bg-moss/10 border-moss/40 text-moss',
  cancelled: 'bg-paper-2 border-line text-ink-50',
};

/** Acik gorev = tamamlanmamis ve iptal edilmemis. */
export const ACIK_DURUMLAR: GorevDurumu[] = ['todo', 'in_progress', 'blocked'];

export function gorevDurumEtiketi(durum: string): string {
  return GOREV_DURUM_ETIKETLERI[durum as GorevDurumu] ?? durum;
}

export function gorevDurumSinifi(durum: string): string {
  return (
    GOREV_DURUM_SINIFLARI[durum as GorevDurumu] ??
    'bg-paper-2 border-line text-ink-72'
  );
}

// -----------------------------------------------------------------------------
// Aktivite cumlesi
// -----------------------------------------------------------------------------

/** `activity_logs` satiri (uygulamanin okudugu alanlar). */
export type AktiviteKaydi = {
  id: number;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  diff: Record<string, unknown>;
  created_at: string;
};

type DegisimCifti = { from?: unknown; to?: unknown };

function cift(deger: unknown): DegisimCifti | null {
  if (!deger || typeof deger !== 'object' || Array.isArray(deger)) return null;
  const o = deger as Record<string, unknown>;
  return 'from' in o || 'to' in o ? (o as DegisimCifti) : null;
}

function metinOlarak(deger: unknown): string | null {
  if (deger === null || deger === undefined) return null;
  if (typeof deger === 'string') return deger;
  if (typeof deger === 'number' || typeof deger === 'boolean') {
    return String(deger);
  }
  return null;
}

/** Tarihi "14 Mayıs 2027" bicimine cevirir (Istanbul). */
function tarihKisa(iso: unknown): string | null {
  const s = metinOlarak(iso);
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  });
}

/**
 * Aktivite kaydini Turkce cumleye cevirir.
 *
 * `adlar`: uuid -> gorunen ad. Tetikleyici diff'e yalniz kimlik yaziyor; adi
 * veri katmani cozer (`aktiviteGetir`). Ad bulunamazsa cumle kimlik YAZMAZ,
 * daha genel bir ifade kurar — arayuzde ham uuid gostermeyiz.
 */
export function aktiviteMetni(
  log: AktiviteKaydi,
  aktorAdi: string,
  adlar?: Map<string, string>
): string {
  const ad = (kimlik: unknown): string | null => {
    const k = metinOlarak(kimlik);
    if (!k) return null;
    return adlar?.get(k) ?? null;
  };
  const baslik = metinOlarak(log.diff.title);
  const baslikCift = cift(log.diff.title);

  // FAZ 8b — kisi (contact) cumleleri. PII diff'e YAZILMAZ: tetikleyici
  // e-posta/telefon/not icin yalniz `true` koyuyor, deger kaydedilmiyor.
  // Cumle de bu yuzden degeri DEGIL "guncelledi" bilgisini tasir.
  if (log.entity_type === 'contact') {
    const kisiAdi = metinOlarak(log.diff.full_name);
    const adCift = cift(log.diff.full_name);

    if (log.action === 'created') {
      return kisiAdi
        ? `${aktorAdi} '${kisiAdi}' kişisini oluşturdu`
        : `${aktorAdi} bir kişi oluşturdu`;
    }
    if (log.action === 'deleted') {
      return kisiAdi
        ? `${aktorAdi} '${kisiAdi}' kişisini sildi`
        : `${aktorAdi} kişiyi sildi`;
    }
    if (adCift) {
      const yeni = metinOlarak(adCift.to);
      return yeni
        ? `${aktorAdi} kişinin adını '${yeni}' yaptı`
        : `${aktorAdi} kişinin adını değiştirdi`;
    }
    const firmaCift = cift(log.diff.company_name);
    if (firmaCift) {
      const yeni = metinOlarak(firmaCift.to);
      return yeni
        ? `${aktorAdi} firmayı '${yeni}' yaptı`
        : `${aktorAdi} firma bilgisini kaldırdı`;
    }
    const turCift = cift(log.diff.kind);
    if (turCift) {
      const yeni = metinOlarak(turCift.to);
      return yeni === 'company'
        ? `${aktorAdi} kaydı firma yaptı`
        : `${aktorAdi} kaydı kişi yaptı`;
    }
    if (log.diff.email === true) return `${aktorAdi} e-postayı güncelledi`;
    if (log.diff.phone === true) return `${aktorAdi} telefonu güncelledi`;
    if (log.diff.notes === true) return `${aktorAdi} notu güncelledi`;
    if (log.diff.linked === true) {
      return `${aktorAdi} kişinin Kashe bağlantısını güncelledi`;
    }
    return `${aktorAdi} kişiyi güncelledi`;
  }

  // FAZ 8b — firsat (lead) cumleleri.
  if (log.entity_type === 'lead') {
    const firsatAdi = metinOlarak(log.diff.title);
    const firsatCift = cift(log.diff.title);

    if (log.action === 'created') {
      return firsatAdi
        ? `${aktorAdi} '${firsatAdi}' fırsatını oluşturdu`
        : `${aktorAdi} bir fırsat oluşturdu`;
    }
    if (log.action === 'deleted') {
      return firsatAdi
        ? `${aktorAdi} '${firsatAdi}' fırsatını sildi`
        : `${aktorAdi} fırsatı sildi`;
    }
    // Asama degisimi ve sahip degisimi AYNI kayitta olabilir (tetikleyici
    // action'i status_changed yapip owner diff'ini de yaziyor); asama once
    // anlatilir, cunku panoda gorunen sutunu o belirler.
    const asamaCift = cift(log.diff.stage);
    if (asamaCift) {
      const yeni = metinOlarak(asamaCift.to);
      const neden = metinOlarak(log.diff.lost_reason);
      if (yeni) {
        const temel = `${aktorAdi} fırsatın aşamasını değiştirdi → ${asamaEtiketi(yeni)}`;
        return neden ? `${temel} (${neden})` : temel;
      }
      return `${aktorAdi} fırsatın aşamasını değiştirdi`;
    }
    const sahipCift = cift(log.diff.owner_user_id);
    if (sahipCift) {
      const yeni = ad(sahipCift.to);
      // EK ALMAYAN KALIP: ok isaretiyle ad cekimi gerekmez (8a dersi).
      if (yeni) return `${aktorAdi} fırsatın sahibini değiştirdi → ${yeni}`;
      if (sahipCift.to == null) {
        return `${aktorAdi} fırsatın sahibini kaldırdı`;
      }
      return `${aktorAdi} fırsatın sahibini değiştirdi`;
    }
    if (firsatCift) {
      const yeni = metinOlarak(firsatCift.to);
      return yeni
        ? `${aktorAdi} fırsatın başlığını '${yeni}' yaptı`
        : `${aktorAdi} fırsatın başlığını değiştirdi`;
    }
    const degerCift = cift(log.diff.estimated_value);
    if (degerCift) {
      // Tutar BICIMLENMEZ: para bicimi `para.ts`'in isi ve bu modul saf
      // metin uretiyor; cumle degerin degistigini soyler, rakami kart yazar.
      return degerCift.to == null
        ? `${aktorAdi} tahmini değeri kaldırdı`
        : `${aktorAdi} tahmini değeri güncelledi`;
    }
    const beklenenCift = cift(log.diff.expected_date);
    if (beklenenCift) {
      const yeni = tarihKisa(beklenenCift.to);
      return yeni
        ? `${aktorAdi} beklenen tarihi değiştirdi → ${yeni}`
        : `${aktorAdi} beklenen tarihi kaldırdı`;
    }
    const adimCift = cift(log.diff.next_step);
    if (adimCift) {
      const yeni = metinOlarak(adimCift.to);
      return yeni
        ? `${aktorAdi} sonraki adımı '${yeni}' yaptı`
        : `${aktorAdi} sonraki adımı kaldırdı`;
    }
    const teklifCift = cift(log.diff.proposal_id);
    if (teklifCift) {
      return teklifCift.to
        ? `${aktorAdi} fırsatı bir teklife bağladı`
        : `${aktorAdi} fırsatı teklifden ayırdı`;
    }
    const firsatEtkinlik = cift(log.diff.event_id);
    if (firsatEtkinlik) {
      return firsatEtkinlik.to
        ? `${aktorAdi} fırsatı bir etkinliğe bağladı`
        : `${aktorAdi} fırsatı etkinlikten ayırdı`;
    }
    const kisiDegisti = cift(log.diff.contact_id);
    if (kisiDegisti) {
      return `${aktorAdi} fırsatın kişisini değiştirdi`;
    }
    return `${aktorAdi} fırsatı güncelledi`;
  }

  // FAZ 8c — tedarikci (supplier) cumleleri. PII diff'e YAZILMAZ:
  // tetikleyici e-posta/telefon/yetkili/web/not icin yalniz `true` koyuyor.
  if (log.entity_type === 'supplier') {
    const tedAdi = metinOlarak(log.diff.name);
    const adCift = cift(log.diff.name);

    if (log.action === 'created') {
      return tedAdi
        ? `${aktorAdi} '${tedAdi}' tedarikçisini ekledi`
        : `${aktorAdi} bir tedarikçi ekledi`;
    }
    if (log.action === 'deleted') {
      return tedAdi
        ? `${aktorAdi} '${tedAdi}' tedarikçisini sildi`
        : `${aktorAdi} tedarikçiyi sildi`;
    }
    // Arsivleme ayri bir eylem gibi anlatilir: listeden dusmesinin sebebi.
    const arsiv = cift(log.diff.is_active);
    if (arsiv) {
      return arsiv.to === false
        ? `${aktorAdi} tedarikçiyi arşivledi`
        : `${aktorAdi} tedarikçiyi arşivden çıkardı`;
    }
    if (adCift) {
      const yeni = metinOlarak(adCift.to);
      return yeni
        ? `${aktorAdi} tedarikçinin adını '${yeni}' yaptı`
        : `${aktorAdi} tedarikçinin adını değiştirdi`;
    }
    const katCift = cift(log.diff.category);
    if (katCift) {
      const yeni = metinOlarak(katCift.to);
      return yeni
        ? `${aktorAdi} kategoriyi değiştirdi → ${kategoriEtiketi(yeni)}`
        : `${aktorAdi} kategoriyi değiştirdi`;
    }
    const puanCift = cift(log.diff.rating);
    if (puanCift) {
      const yeni = metinOlarak(puanCift.to);
      return yeni
        ? `${aktorAdi} puanı ${yeni} yaptı`
        : `${aktorAdi} puanı kaldırdı`;
    }
    if (cift(log.diff.city_id)) return `${aktorAdi} şehri güncelledi`;
    // Iletisim alanlarinin DEGERI loglanmiyor; cumle de yazmaz.
    if (
      log.diff.email === true ||
      log.diff.phone === true ||
      log.diff.contact_name === true ||
      log.diff.website === true
    ) {
      return `${aktorAdi} iletişim bilgisini güncelledi`;
    }
    if (log.diff.notes === true) return `${aktorAdi} notu güncelledi`;
    if (log.diff.linked === true) {
      return `${aktorAdi} Kashe bağlantısını güncelledi`;
    }
    return `${aktorAdi} tedarikçiyi güncelledi`;
  }

  // FAZ 8c — etkinlige tedarikci atamasi (event_supplier).
  if (log.entity_type === 'event_supplier') {
    // Tedarikci adi diff'te KIMLIK olarak duruyor; adi `adlar` cozer.
    const tedAdi = ad(log.diff.supplier_id) ?? ad(cift(log.diff.supplier_id)?.to);

    if (log.action === 'created') {
      return tedAdi
        ? `${aktorAdi} etkinliğe '${tedAdi}' tedarikçisini ekledi`
        : `${aktorAdi} etkinliğe tedarikçi ekledi`;
    }
    if (log.action === 'deleted') {
      return tedAdi
        ? `${aktorAdi} '${tedAdi}' tedarikçisini kaldırdı`
        : `${aktorAdi} tedarikçiyi kaldırdı`;
    }
    const durumCift = cift(log.diff.status);
    if (durumCift) {
      const yeni = metinOlarak(durumCift.to);
      return yeni
        ? `${aktorAdi} tedarikçi durumunu değiştirdi → ${durumEtiketi(yeni)}`
        : `${aktorAdi} tedarikçi durumunu değiştirdi`;
    }
    const hizmetCift = cift(log.diff.service);
    if (hizmetCift) {
      const yeni = metinOlarak(hizmetCift.to);
      return yeni
        ? `${aktorAdi} hizmeti '${yeni}' yaptı`
        : `${aktorAdi} hizmet bilgisini kaldırdı`;
    }
    if (cift(log.diff.supplier_id)) {
      return tedAdi
        ? `${aktorAdi} atamayı '${tedAdi}' tedarikçisine taşıdı`
        : `${aktorAdi} atamanın tedarikçisini değiştirdi`;
    }
    if (log.diff.notes === true) return `${aktorAdi} atama notunu güncelledi`;
    return `${aktorAdi} tedarikçi atamasını güncelledi`;
  }

  // FAZ 8c — alici kisa listesi (shortlist). Kalem ekleme/cikarma da bu
  // varligin altinda loglanir (entity_id = LISTE kimligi).
  if (log.entity_type === 'shortlist') {
    const listeAdi = metinOlarak(log.diff.name);
    const eklenen = ad(log.diff.item_added);
    const cikarilan = ad(log.diff.item_removed);

    if (log.diff.item_added !== undefined) {
      return eklenen
        ? `${aktorAdi} kısa listeye '${eklenen}' ekledi`
        : `${aktorAdi} kısa listeye sağlayıcı ekledi`;
    }
    if (log.diff.item_removed !== undefined) {
      // EK ALMAYAN KALIP: "'<ad>'yi" gibi ekler ada gore degisiyor ve kod bunu
      // bilemiyor; ok isaretiyle ek gereksiz kalir (8a dersi).
      return cikarilan
        ? `${aktorAdi} kısa listeden çıkardı → ${cikarilan}`
        : `${aktorAdi} kısa listeden sağlayıcı çıkardı`;
    }
    if (log.action === 'created') {
      return listeAdi
        ? `${aktorAdi} '${listeAdi}' kısa listesini oluşturdu`
        : `${aktorAdi} bir kısa liste oluşturdu`;
    }
    if (log.action === 'deleted') {
      return listeAdi
        ? `${aktorAdi} '${listeAdi}' kısa listesini sildi`
        : `${aktorAdi} kısa listeyi sildi`;
    }
    const listeAdCift = cift(log.diff.name);
    if (listeAdCift) {
      const yeni = metinOlarak(listeAdCift.to);
      return yeni
        ? `${aktorAdi} liste adını '${yeni}' yaptı`
        : `${aktorAdi} liste adını değiştirdi`;
    }
    return `${aktorAdi} kısa listeyi güncelledi`;
  }
  if (log.entity_type !== 'task') {
    // Gorev, kisi ve firsat disindaki varliklar icin genel cumle.
    const varlik =
      log.entity_type === 'event'
        ? 'etkinlik'
        : log.entity_type === 'proposal'
          ? 'teklif'
          : log.entity_type === 'rfp'
            ? 'teklif talebi'
            : log.entity_type === 'booking'
              ? 'rezervasyon'
              : log.entity_type === 'crew'
                ? 'ekip'
                : 'kayıt';
    const eylem =
      log.action === 'created'
        ? 'oluşturdu'
        : log.action === 'deleted'
          ? 'sildi'
          : log.action === 'status_changed'
            ? 'durumunu değiştirdi'
            : log.action === 'assigned'
              ? 'atama yaptı'
              : 'güncelledi';
    return `${aktorAdi} ${varlik} kaydını ${eylem}`;
  }

  if (log.action === 'created') {
    return baslik
      ? `${aktorAdi} '${baslik}' görevini oluşturdu`
      : `${aktorAdi} bir görev oluşturdu`;
  }

  if (log.action === 'deleted') {
    return baslik
      ? `${aktorAdi} '${baslik}' görevini sildi`
      : `${aktorAdi} görevi sildi`;
  }

  if (log.action === 'status_changed') {
    const d = cift(log.diff.status);
    const eski = metinOlarak(d?.from);
    const yeni = metinOlarak(d?.to);
    if (eski && yeni) {
      return `${aktorAdi} durumu ${gorevDurumEtiketi(eski)} → ${gorevDurumEtiketi(yeni)} yaptı`;
    }
    return `${aktorAdi} görevin durumunu değiştirdi`;
  }

  if (log.action === 'assigned') {
    const uye = cift(log.diff.assignee_user_id);
    const havuz = cift(log.diff.assignee_talent_record_id);
    const yeniUye = ad(uye?.to);
    const yeniHavuz = ad(havuz?.to);
    const hedef = yeniUye ?? yeniHavuz;
    // EK ALMAYAN KALIP: "Test Pro'ye" / "Guven'e" gibi ekler ada gore
    // degisiyor ve kod bunu bilemiyor; ok isaretiyle ek gereksiz kalir.
    if (hedef) return `${aktorAdi} görevin atananını değiştirdi → ${hedef}`;
    // Atama KALDIRILDI (to boş, from dolu)
    if (uye?.to == null && havuz?.to == null) {
      return `${aktorAdi} görevin atamasını kaldırdı`;
    }
    return `${aktorAdi} görevi atadı`;
  }

  // action = 'updated' — degisen ilk anlamli alani anlatir
  if (baslikCift) {
    const yeni = metinOlarak(baslikCift.to);
    return yeni
      ? `${aktorAdi} başlığı '${yeni}' yaptı`
      : `${aktorAdi} başlığı değiştirdi`;
  }
  const sonTarih = cift(log.diff.due_at);
  if (sonTarih) {
    const yeni = tarihKisa(sonTarih.to);
    return yeni
      ? `${aktorAdi} son tarihi değiştirdi → ${yeni}`
      : `${aktorAdi} son tarihi kaldırdı`;
  }
  const kilometre = cift(log.diff.is_milestone);
  if (kilometre) {
    return kilometre.to === true
      ? `${aktorAdi} görevi kilometre taşı yaptı`
      : `${aktorAdi} kilometre taşı işaretini kaldırdı`;
  }
  const bagimlilik = cift(log.diff.depends_on_task_id);
  if (bagimlilik) {
    const yeni = ad(bagimlilik.to);
    return yeni
      ? `${aktorAdi} görevi '${yeni}' görevine bağladı`
      : `${aktorAdi} görev bağımlılığını kaldırdı`;
  }
  const etkinlik = cift(log.diff.event_id);
  if (etkinlik) {
    return etkinlik.to
      ? `${aktorAdi} görevi bir etkinliğe bağladı`
      : `${aktorAdi} görevi etkinlikten ayırdı`;
  }
  if (log.diff.description === true) {
    return `${aktorAdi} açıklamayı güncelledi`;
  }
  return `${aktorAdi} görevi güncelledi`;
}

// -----------------------------------------------------------------------------
// DB hata eslemesi
// -----------------------------------------------------------------------------

/**
 * Tetikleyici ve kisit metinlerini kullaniciya gosterilecek Turkce cumleye
 * cevirir. Metinler migration'daki `RAISE EXCEPTION` govdeleriyle BIREBIR
 * eslesir (ASCII; hijyen_02 dersi: DB metni ASCII, UI metni Turkce karakterli).
 *
 * Eslesmeyen hata icin genel bir cumle doner ve ham DB metni kullaniciya
 * SIZDIRILMAZ (gelistirici konsolda gorur).
 */
const HATA_ESLEMESI: { parca: string; mesaj: string }[] = [
  {
    parca: 'gorev modulu bu kurulusta kapali',
    mesaj: 'Görevler modülü bu kuruluşta kapalı.',
  },
  {
    parca: 'atanan kisi kurulusun aktif uyesi degil',
    mesaj: 'Atanan kişi kuruluşun aktif üyesi değil.',
  },
  {
    parca: 'havuz kaydi bu kurulusa ait degil',
    mesaj: 'Seçilen havuz kaydı bu kuruluşa ait değil.',
  },
  {
    parca: 'etkinlik bu kurulusa ait degil',
    mesaj: 'Seçilen etkinlik bu kuruluşa ait değil.',
  },
  {
    parca: 'bagli gorev bu kurulusa ait degil',
    mesaj: 'Bağlanacak görev bu kuruluşa ait değil.',
  },
  {
    parca: 'ekip bu kurulusa ait degil',
    mesaj: 'Seçilen ekip bu kuruluşa ait değil.',
  },
  {
    parca: 'gorevin kurulusu degistirilemez',
    mesaj: 'Görevin kuruluşu değiştirilemez.',
  },
  {
    parca: 'yalniz yapilacak ya da iptal durumundaki gorev silinir',
    mesaj: 'Yalnız yapılacak ya da iptal durumundaki görev silinebilir.',
  },
  {
    parca: 'tasks_title_check',
    mesaj: 'Başlık 2–200 karakter olmalı.',
  },
  {
    parca: 'tasks_description_check',
    mesaj: 'Açıklama en fazla 4000 karakter olabilir.',
  },
  {
    parca: 'tasks_no_self_dep_check',
    mesaj: 'Görev kendisine bağlanamaz.',
  },
  {
    parca: 'oturum gerekir',
    mesaj: 'Oturum gerekiyor. Yeniden giriş yap.',
  },
  {
    parca: 'bu modul buradan acilamaz',
    mesaj: 'Bu modül buradan açılamaz.',
  },
];

export function gorevHataMetni(hata: {
  code?: string | null;
  message?: string | null;
} | null): string {
  if (!hata) return 'Beklenmeyen bir hata oldu.';
  const ham = (hata.message ?? '').toLowerCase();
  for (const { parca, mesaj } of HATA_ESLEMESI) {
    if (ham.includes(parca.toLowerCase())) return mesaj;
  }
  if (hata.code === '42501') return 'Bu işlem için yetkin yok.';
  if (hata.code === '23503') return 'Seçilen kayıt bulunamadı.';
  return 'İşlem tamamlanamadı. Alanları kontrol edip yeniden dene.';
}
