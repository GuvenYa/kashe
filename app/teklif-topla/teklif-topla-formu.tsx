'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createQuoteRequest } from './actions';
import { createClient } from '@/app/lib/supabase-browser';
import { useEtkinlikTurleri } from '@/app/components/etkinlik-turleri-provider';
import {
  getBriefFields,
  getBriefIntro,
  type BriefField,
} from '@/app/lib/brief-config';
import {
  OnBehalfSelector,
  type OnBehalfBusiness,
} from '@/app/components/on-behalf-selector';
import { BriefAlanlari } from '@/app/components/brief/brief-alanlari';
import { IlceSecici } from '@/app/components/ui/il-secici';
import {
  ilceEslestir,
  ilceListesi,
  ilceTasi,
  konumBirlestir,
} from '@/app/lib/ilceler';
import { VurguEtiketi } from '@/app/components/ui/vurgu-etiketi';
import {
  SegmentSecici,
  SecimKutulari,
  SecimCipleri,
  type Secenek,
} from '@/app/components/ui/secim';
import { DurumKarti } from '@/app/components/panel/durum-karti';
import { OzetSerit } from '@/app/components/panel/ozet-serit';
import {
  BRIEF_ACIKLAMA_SONEKI,
  BRIEF_ESNEK_SONEKI,
} from '@/app/lib/brief-anahtarlari';

type Category = { id: number; slug: string; name_tr: string };
type City = { id: number; name: string };

const MAX_BRIEF_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const BRIEF_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BRIEF_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function briefAttachmentKind(mime: string): 'image' | 'pdf' | 'doc' | null {
  if (BRIEF_IMAGE_TYPES.includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (BRIEF_DOC_TYPES.includes(mime)) return 'doc';
  return null;
}

/**
 * Duzeltme 15 (gorsel dil): gonderim ayarlari ekip kurma ekranindaki
 * kaliplarla secilir (segment, secili kutu, cip); degerler ve eylem ayni.
 */
const RECIPIENT_OPTIONS: Secenek<number>[] = [
  { deger: 5, etiket: '5 profesyonel', ipucu: 'Dar ve kontrollü' },
  { deger: 10, etiket: '10 profesyonel', ipucu: 'Önerilen' },
  { deger: 20, etiket: '20 profesyonel', ipucu: 'Daha fazla teklif' },
];

const DEADLINE_OPTIONS: Secenek<number>[] = [
  { deger: 1, etiket: '24 saat' },
  { deger: 2, etiket: '48 saat' },
  { deger: 3, etiket: '3 gün' },
  { deger: 7, etiket: '1 hafta' },
];

type HedefRol = 'both' | 'professional' | 'agency';

const TARGET_ROLE_OPTIONS: Secenek<HedefRol>[] = [
  { deger: 'both', etiket: 'Hepsi' },
  { deger: 'professional', etiket: 'Profesyoneller' },
  { deger: 'agency', etiket: 'Ajanslar' },
];

/** Serit ozetindeki "10 profesyonele" eki. */
const HEDEF_METNI: Record<HedefRol, string> = {
  both: 'profesyonel ve ajansa',
  professional: 'profesyonele',
  agency: 'ajansa',
};

/**
 * Sihirbazdan (/etkinlik-sihirbazi) gelen ön-doldurma. Hepsi OPSİYONEL ve
 * yalnız BAŞLANGIÇ değeridir — kullanıcı her alanı serbestçe değiştirebilir,
 * hiçbir alan kilitlenmez.
 */
export type TeklifOnDoldur = {
  kategoriId: number | null;
  sehirId: number | null;
  /** `event_types.key` -> brief 'event_type' alani */
  etkinlikTuru: string | null;
  /** ISO tarih → brief 'event_date' alanı */
  etkinlikTarihi: string | null;
  /** FAZ 4c/P3: events.id — sunucuda dogrulanmis; talep bu etkinlige baglanir. */
  etkinlikId?: string | null;
  /** Etkinlikten gelen butce araligi (TL) — yalniz baslangic degeri. */
  butceMin?: number | null;
  butceMax?: number | null;
  /**
   * Duzeltme 18-A: sihirbazdan gelen ilce / semt metni. Sehir buyuksehirse ve
   * metin listedeki bir ilceyle eslesirse ilce kutusu, aksi halde "ilce /
   * mekan" metni bununla dolu baslar. Sehir yoksa kullanilmaz.
   */
  ilce?: string | null;
};

export function TeklifToplaFormu({
  categories,
  cities,
  writableBusinesses = [],
  canSelfCreate = true,
  onDoldur,
  donusYolu = '/teklif-taleplerim',
}: {
  categories: Category[];
  cities: City[];
  writableBusinesses?: OnBehalfBusiness[];
  canSelfCreate?: boolean;
  onDoldur?: TeklifOnDoldur;
  /**
   * Talep gonderilince gidilecek sayfa. Musteri hesabinda "Etkinliklerim"
   * merkezi (Duzeltme 15-A); kurum panelinde eski liste. Karar sunucuda.
   */
  donusYolu?: string;
}) {
  // FAZ 10b: etkinlik turleri `event_types` tablosundan (saglayici).
  const etkinlikTurleriListesi = useEtkinlikTurleri();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // "Kimin adına": null = kendi adına; kendi adına uygun değilse ilk kurum default
  const [onBehalfBusinessId, setOnBehalfBusinessId] = useState<string | null>(
    canSelfCreate ? null : writableBusinesses[0]?.business_id ?? null
  );

  // Ön-doldurma yalnız BAŞLANGIÇ değeri: geçerli bir id ise kullanılır, aksi halde boş.
  const gecerliKategori =
    onDoldur?.kategoriId != null &&
    categories.some((c) => c.id === onDoldur.kategoriId)
      ? onDoldur.kategoriId
      : '';
  const gecerliSehir =
    onDoldur?.sehirId != null && cities.some((c) => c.id === onDoldur.sehirId)
      ? onDoldur.sehirId
      : '';

  const [categoryId, setCategoryId] = useState<number | ''>(gecerliKategori);
  const [cityId, setCityId] = useState<number | ''>(gecerliSehir);

  /**
   * Duzeltme 18-A: sehir secildiyse ILCE ve MEKAN da yazilabilir. Sehir 30
   * buyuksehirden biriyse ilce listeden secilir (`app/lib/ilceler.ts`), metin
   * alani "Mekan" olur; diger illerde tek "Ilce / mekan" metni vardir.
   * Ikisi de istege bagli ve yalniz BILGIDIR: eslestirme sehre gore yapilir.
   * Deger brief'in konum alanina diger formlarla ayni bicimde yazilir
   * ("<mekan>, <ilce>, <Il>"); profesyonel yanit verince sohbetin ve dogacak
   * rezervasyonun yeri olur (`submitOffer`).
   */
  const sehirAdiBul = (id: number | ''): string =>
    id === '' ? '' : (cities.find((c) => c.id === id)?.name ?? '');
  const ilkIlceMetni = (onDoldur?.ilce ?? '').trim().slice(0, 80);
  const ilkIlce = ilceEslestir(ilkIlceMetni, sehirAdiBul(gecerliSehir));
  const [ilce, setIlce] = useState(ilkIlce);
  const [mekan, setMekan] = useState(
    gecerliSehir !== '' && !ilkIlce ? ilkIlceMetni : ''
  );
  const sehirIlceleri = ilceListesi(sehirAdiBul(cityId));
  const secilenIlce = sehirIlceleri ? ilce : '';
  const [briefValues, setBriefValues] = useState<Record<string, string>>(() => {
    // Brief alanları kategoriye göre değişir; anahtarlar sabit olduğu için
    // (event_type / event_date, bkz. brief-config) doğrudan yazılabilir.
    // Seçili kategoride bu alanlar yoksa değer sessizce kullanılmaz.
    const bas: Record<string, string> = {};
    if (onDoldur?.etkinlikTuru) bas.event_type = onDoldur.etkinlikTuru;
    if (onDoldur?.etkinlikTarihi) bas.event_date = onDoldur.etkinlikTarihi;
    return bas;
  });
  const [recipientCount, setRecipientCount] = useState(10);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [shareBudget, setShareBudget] = useState(true);
  const [targetRole, setTargetRole] = useState<HedefRol>('both');
  const [budgetMin, setBudgetMin] = useState(
    onDoldur?.butceMin != null ? String(onDoldur.butceMin) : ''
  );
  const [budgetMax, setBudgetMax] = useState(
    onDoldur?.butceMax != null ? String(onDoldur.butceMax) : ''
  );
  // Etkinlik bagi: gizli, kullanici degistiremez. Sunucu yine de dogrular.
  const etkinlikId = onDoldur?.etkinlikId ?? null;
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!briefAttachmentKind(selected.type)) {
      setError('Desteklenmeyen dosya tipi. Görsel, PDF veya Word ekleyebilirsin.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selected.size > MAX_BRIEF_FILE_SIZE) {
      setError("Dosya 20 MB'dan büyük olamaz.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);
  }

  const selectedSlug =
    categoryId === ''
      ? null
      : categories.find((c) => c.id === categoryId)?.slug ?? null;
  // FAZ 10b: `event_type` alaninin secenekleri `event_types` tablosundan
  // (saglayici; yalniz aktif turler).
  const briefFields: BriefField[] = getBriefFields(
    selectedSlug,
    etkinlikTurleriListesi
  );
  const briefIntro = getBriefIntro(selectedSlug);

  function setField(key: string, value: string) {
    setBriefValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (categoryId === '') {
      setError('Önce bir kategori seç.');
      return;
    }

    for (const f of briefFields) {
      const esnek =
        (briefValues[`${f.key}${BRIEF_ESNEK_SONEKI}`] ?? '') === '1';
      // Duzeltme 10-E2: "tarih henuz belli degil" isaretliyse zorunluluk kalkar.
      if (f.type === 'date' && esnek) continue;
      // E3: "Diger" secildiyse aciklama zorunlu.
      if (
        f.type === 'select' &&
        briefValues[f.key] === 'other' &&
        !(briefValues[`${f.key}${BRIEF_ACIKLAMA_SONEKI}`] ?? '').trim()
      ) {
        // Duzeltme 11-F2: hata metni alanin kendi adini soyler.
        setError(`"${f.label}" için kısa açıklama yaz.`);
        return;
      }
      if (f.required && !(briefValues[f.key] && briefValues[f.key].trim())) {
        setError(`"${f.label}" alanı zorunlu.`);
        return;
      }
    }

    let legacyEventType: string | null = null;
    let legacyEventDate: string | null = null;

    for (const f of briefFields) {
      const raw = briefValues[f.key]?.trim();
      if (!raw || !f.legacyColumn) continue;
      if (f.legacyColumn === 'event_type') legacyEventType = raw;
      if (f.legacyColumn === 'event_date') legacyEventDate = raw;
    }

    const cleanBrief: Record<string, string> = {};
    for (const f of briefFields) {
      const raw = briefValues[f.key]?.trim();
      if (raw) cleanBrief[f.key] = raw;
      // Duzeltme 10-E: ek anahtarlar da gider ("Diger" aciklamasi, tarih
      // esnek); sunucu `briefVeriTemizle` ile tip ve uzunlugu sabitler.
      const aciklama = briefValues[`${f.key}${BRIEF_ACIKLAMA_SONEKI}`]?.trim();
      if (aciklama) cleanBrief[`${f.key}${BRIEF_ACIKLAMA_SONEKI}`] = aciklama;
      if (briefValues[`${f.key}${BRIEF_ESNEK_SONEKI}`] === '1') {
        cleanBrief[`${f.key}${BRIEF_ESNEK_SONEKI}`] = '1';
      }
    }

    // Duzeltme 18-A: ilce / mekan yazildiysa brief'in konum alanina gider.
    // Yalniz sehir secildiyse yazilmaz (sehir zaten `city_id`de).
    const konumAlani = briefFields.find((f) => f.legacyColumn === 'location');
    const konumSehri = sehirAdiBul(cityId);
    if (konumAlani && konumSehri && (secilenIlce || mekan.trim())) {
      cleanBrief[konumAlani.key] = konumBirlestir(
        konumSehri,
        secilenIlce,
        mekan
      );
    }

    // Bütçe parse (Türkçe binlik ayraç temizle)
    const parseBudget = (s: string): number | null => {
      const cleaned = s.trim().replace(/\./g, '').replace(',', '.');
      if (cleaned === '') return null;
      const n = parseFloat(cleaned);
      return isNaN(n) || n < 0 ? null : n;
    };
    const bMin = parseBudget(budgetMin);
    const bMax = parseBudget(budgetMax);

    if (bMin !== null && bMax !== null && bMin > bMax) {
      setError('Minimum bütçe maksimumdan büyük olamaz.');
      return;
    }

    const targetRoles: ('professional' | 'agency')[] =
      targetRole === 'both'
        ? ['professional', 'agency']
        : [targetRole];

    startTransition(async () => {
      let attachment:
        | { path: string; type: 'image' | 'pdf' | 'doc'; name: string }
        | null = null;

      // Dosya seçildiyse önce storage'a yükle
      if (file) {
        const kind = briefAttachmentKind(file.type);
        if (!kind) {
          setError('Desteklenmeyen dosya tipi.');
          return;
        }
        setUploading(true);
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            setError('Oturum bulunamadı.');
            setUploading(false);
            return;
          }
          const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
          const path = `${user.id}/${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('quote-attachments')
            .upload(path, file, { cacheControl: '3600', upsert: false });
          if (upErr) {
            setError('Dosya yüklenemedi: ' + upErr.message);
            setUploading(false);
            return;
          }
          attachment = { path, type: kind, name: file.name };
        } catch (err) {
          setError(
            'Yükleme hatası: ' +
              (err instanceof Error ? err.message : 'bilinmeyen')
          );
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      const result = await createQuoteRequest({
        on_behalf_business_id: onBehalfBusinessId,
        category_id: categoryId,
        city_id: cityId === '' ? null : cityId,
        brief_data: Object.keys(cleanBrief).length > 0 ? cleanBrief : null,
        event_date: legacyEventDate,
        event_type: legacyEventType,
        budget_min: bMin,
        budget_max: bMax,
        share_budget: shareBudget,
        response_deadline_days: deadlineDays,
        recipient_count: recipientCount,
        target_roles: targetRoles,
        attachment,
        event_id: etkinlikId,
      });

      if (result.success && result.data) {
        router.push(donusYolu);
      } else if (!result.success) {
        setError(result.error);
        // Talep başarısızsa yüklenen dosyayı temizle
        if (attachment) {
          const supabase = createClient();
          await supabase.storage
            .from('quote-attachments')
            .remove([attachment.path]);
        }
      }
    });
  }

  // --- Duzeltme 15: ustteki durum karti ve alttaki serit icin ozet ---
  const kategoriAdi =
    categoryId === ''
      ? null
      : (categories.find((c) => c.id === categoryId)?.name_tr ?? null);
  const sehirAdi =
    cityId === '' ? null : (cities.find((c) => c.id === cityId)?.name ?? null);
  const eksikZorunlu = briefFields.filter((f) => {
    const esnek = (briefValues[`${f.key}${BRIEF_ESNEK_SONEKI}`] ?? '') === '1';
    if (f.type === 'date' && esnek) return false;
    return f.required && !(briefValues[f.key] ?? '').trim();
  }).length;
  const kategoriSecili = categoryId !== '';
  const detayTamam = kategoriSecili && eksikZorunlu === 0;
  const sureEtiketi =
    DEADLINE_OPTIONS.find((o) => o.deger === deadlineDays)?.etiket ?? '';
  const butceGirildi = !!(budgetMin.trim() || budgetMax.trim());
  const gonderimOzeti = `${recipientCount} ${HEDEF_METNI[targetRole]} · ${sureEtiketi} içinde dönüş`;

  // Hata formun sonunda yazilir; gonder seridi sabit oldugu icin kullanici
  // yukaridayken gorunmuyordu. Hata cikinca gorunur alana kaydirilir.
  const hataKutusu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) {
      hataKutusu.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [error]);

  const inputClass =
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DurumKarti
        baslik={
          !kategoriSecili
            ? 'Talebini hazırla'
            : detayTamam
              ? 'Talep gönderilmeye hazır'
              : 'Talep hazırlanıyor'
        }
        tamam={detayTamam}
        ilerleme={!kategoriSecili ? 8 : detayTamam ? 100 : 55}
        satirlar={[
          {
            tamam: kategoriSecili,
            metin: kategoriAdi ? `Kategori: ${kategoriAdi}` : 'Kategori seç',
          },
          {
            tamam: kategoriSecili,
            metin: sehirAdi
              ? `Şehir: ${sehirAdi}`
              : 'Şehir seçilmedi: tüm şehirlere gider',
          },
          {
            tamam: detayTamam,
            metin: !kategoriSecili
              ? 'Etkinlik detayları'
              : eksikZorunlu > 0
                ? `Etkinlik detayları: ${eksikZorunlu} zorunlu alan eksik`
                : 'Etkinlik detayları tamam',
          },
          {
            tamam: kategoriSecili,
            metin: `Gönderim: ${gonderimOzeti}`,
          },
        ]}
        kutular={[
          { etiket: 'Kime', deger: recipientCount },
          { etiket: 'Dönüş', deger: sureEtiketi },
          {
            etiket: 'Bütçe',
            deger: butceGirildi ? (shareBudget ? 'Açık' : 'Gizli') : '—',
          },
        ]}
      />

      {etkinlikId && (
        <p className="text-sm text-ink-72 bg-brand-ink-08 border border-brand-ink/25 rounded-lg px-4 py-2.5">
          Bu talep{' '}
          <a
            href={`/etkinliklerim/${etkinlikId}`}
            className="text-brand-ink hover:underline font-medium"
          >
            etkinliğine
          </a>{' '}
          bağlanacak.
        </p>
      )}
      {/* Kimin adına (manager+ kurum üyesine görünür) */}
      {writableBusinesses.length > 0 && (
        <section className="bg-card border border-line rounded-xl p-6">
          <OnBehalfSelector
            businesses={writableBusinesses}
            canSelfCreate={canSelfCreate}
            value={onBehalfBusinessId}
            onChange={setOnBehalfBusinessId}
          />
        </section>
      )}

      {/* Bölüm 1: Kategori + şehir */}
      <section className="bg-card border border-line rounded-xl p-6">
        <div className="mb-5">
          <VurguEtiketi>1 · Ne arıyorsun?</VurguEtiketi>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Kategori <span className="text-danger">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(
                  e.target.value ? parseInt(e.target.value, 10) : ''
                );
                setBriefValues({});
              }}
              required
              className={inputClass}
            >
              <option value="">Kategori seç...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_tr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Şehir
            </label>
            <select
              value={cityId}
              onChange={(e) => {
                const yeniId = e.target.value
                  ? parseInt(e.target.value, 10)
                  : '';
                // Ilce ve mekan sehre baglidir: yeni sehrin listesinde
                // olmayan ilce ve eski sehrin mekani tasinmaz.
                setIlce(ilceTasi(sehirAdiBul(yeniId), ilce));
                if (yeniId !== cityId) setMekan('');
                setCityId(yeniId);
              }}
              className={inputClass}
            >
              <option value="">Tüm şehirler</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              Şehir seçersen sadece o şehirdeki profesyonellere gider
            </p>
          </div>
          {cityId !== '' && (
            /* Duzeltme 18-A: ilce (buyuksehirde listeden) ve mekan. */
            <div className="md:col-span-2">
              <label
                htmlFor={sehirIlceleri ? 'teklif-topla-ilce' : 'teklif-topla-mekan'}
                className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2"
              >
                {sehirIlceleri ? 'İlçe ve mekan' : 'İlçe / mekan'}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sehirIlceleri && (
                  <IlceSecici
                    key={cityId}
                    id="teklif-topla-ilce"
                    ilceler={sehirIlceleri}
                    deger={secilenIlce}
                    onChange={setIlce}
                  />
                )}
                <input
                  id="teklif-topla-mekan"
                  type="text"
                  maxLength={80}
                  value={mekan}
                  onChange={(e) => setMekan(e.target.value.slice(0, 80))}
                  aria-label={sehirIlceleri ? 'Mekan' : 'İlçe / mekan'}
                  placeholder={
                    sehirIlceleri
                      ? 'Mekan (isteğe bağlı)'
                      : 'İlçe / mekan (isteğe bağlı)'
                  }
                  className={inputClass}
                />
              </div>
              <p className="text-[10px] text-ink-72 mt-1 font-mono">
                İsteğe bağlı. Profesyonellere bilgi olarak gider; talep şehre
                göre iletilir
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Bölüm 2: Brief */}
      {categoryId !== '' && (
        <section className="bg-card border border-line rounded-xl p-6">
          <div className="mb-3">
            <VurguEtiketi>2 · Etkinlik detayları</VurguEtiketi>
          </div>
          {briefIntro && (
            <p className="text-sm text-ink-72 mb-4 -mt-1">{briefIntro}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Duzeltme 10-E: alanlar ORTAK cizicide (tarih esnek kutusu,
                "Diger" aciklamasi). `location` burada HARIC: bu sayfanin kendi
                il acilir kutusu var (yukarida), butce de ayri sorulur. */}
            <BriefAlanlari
              alanlar={briefFields.filter(
                (field) =>
                  field.legacyColumn !== 'location' &&
                  field.legacyColumn !== 'budget_range'
              )}
              degerler={briefValues}
              setAlan={setField}
            />
          </div>
          <p className="text-xs text-ink-72 mt-3">
            Yıldızlı (*) alanlar zorunlu — diğerlerini bildiğin kadar doldur.
          </p>
        </section>
      )}

      {/* Bölüm 3: Gönderim ayarları */}
      {categoryId !== '' && (
        <section className="bg-card border border-line rounded-xl p-6">
          <div className="mb-5">
            <VurguEtiketi>3 · Gönderim ayarları</VurguEtiketi>
          </div>

          <div className="space-y-5">
            <div>
              <p className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Kimlere gönderilsin?
              </p>
              <SegmentSecici
                etiket="Kimlere gönderilsin?"
                secenekler={TARGET_ROLE_OPTIONS}
                deger={targetRole}
                onDegis={setTargetRole}
              />
              <p className="text-xs text-ink-72 mt-1.5">
                Premium profesyoneller önce listelenir.
              </p>
            </div>

            <div>
              <p className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Kaç profesyonele gönderilsin?
              </p>
              <SecimKutulari
                etiket="Kaç profesyonele gönderilsin?"
                secenekler={RECIPIENT_OPTIONS}
                deger={recipientCount}
                onDegis={setRecipientCount}
              />
            </div>

            <div>
              <p className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Teklif dönüş süresi
              </p>
              <SecimCipleri
                etiket="Teklif dönüş süresi"
                secenekler={DEADLINE_OPTIONS}
                deger={deadlineDays}
                onDegis={setDeadlineDays}
              />
              <p className="text-xs text-ink-72 mt-1.5">
                Profesyoneller bu süre içinde teklif verir; süre dolunca gelen
                teklifleri karşılaştırırsın.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Bütçe aralığın (opsiyonel)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="Min TL"
                  className={inputClass}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="Max TL"
                  className={inputClass}
                />
              </div>
              <p className="text-[10px] text-ink-72 mt-1.5 font-mono">
                Boş bırakabilirsin — profesyoneller yine teklif verir
              </p>
            </div>

            {/* Dosya eki (opsiyonel) */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Dosya ekle (opsiyonel)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
                id="brief-file-input"
              />
              {file ? (
                <div className="flex items-center gap-3 bg-card border border-line rounded-lg px-3 py-2.5">
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-brand-ink/10 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-ink)" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-ink truncate">
                      {file.name}
                    </span>
                    <span className="block text-[10px] text-ink-72">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="shrink-0 text-ink-72 hover:text-brand-ink text-lg leading-none w-7 h-7 flex items-center justify-center"
                    aria-label="Dosyayı kaldır"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="brief-file-input"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-line rounded-lg text-sm text-ink-72 hover:text-brand-ink hover:border-brand-ink transition cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Örnek görsel, plan veya brief ekle
                </label>
              )}
              <p className="text-[10px] text-ink-72 mt-1.5">
                Görsel, PDF veya Word · max 20 MB
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareBudget}
                onChange={(e) => setShareBudget(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-brand-ink cursor-pointer"
              />
              <span className="text-sm text-ink-72 leading-snug">
                Bütçe bilgimi profesyonellerle paylaş. Kapatırsan teklifler
                bütçeni görmeden gelir.
              </span>
            </label>
          </div>
        </section>
      )}

      {error && (
        <div
          ref={hataKutusu}
          role="alert"
          className="bg-danger-08 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3"
        >
          {error}
        </div>
      )}

      {/* Duzeltme 15: gonder dugmesi ekip kurma ekranindaki koyu seritte;
          ozet solda, eylem sagda. Serit formun ICINDE: dugme formu gonderir. */}
      {kategoriSecili && (
        <OzetSerit
          koyu
          herGenislik
          etiket="Talep özeti"
          deger={`${kategoriAdi ?? ''} · ${sehirAdi ?? 'Tüm şehirler'}`}
          orta={
            <p className="text-sm text-paper-72 truncate">
              {gonderimOzeti}
              {butceGirildi
                ? shareBudget
                  ? ' · bütçe paylaşılıyor'
                  : ' · bütçe gizli'
                : ''}
            </p>
          }
          aksiyon={
            <button
              type="submit"
              disabled={isPending}
              className="kashe-tap px-5 py-2.5 bg-brand-accent text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {uploading ? (
                'Dosya yükleniyor…'
              ) : isPending ? (
                'Gönderiliyor…'
              ) : (
                <>
                  {/* Dar ekranda serit tek satirda kalsin. */}
                  <span className="sm:hidden">Gönder →</span>
                  <span className="hidden sm:inline">Teklif talebini gönder →</span>
                </>
              )}
            </button>
          }
        />
      )}
    </form>
  );
}