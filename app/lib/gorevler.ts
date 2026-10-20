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

  if (log.entity_type !== 'task') {
    // Bugun yalniz gorev tetikleyicisi log yaziyor; diger varliklar FAZ 8b+.
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
    if (hedef) return `${aktorAdi} görevi ${hedef}'ye atadı`;
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
      ? `${aktorAdi} son tarihi ${yeni} yaptı`
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
