'use client';
import { formatTL } from '@/app/lib/para';

import { useState, useEffect, useRef, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  startConversation,
  sendMessageWithAttachment,
} from '@/app/mesajlar/actions';
import { createClient } from '@/app/lib/supabase-browser';
import {
  MAX_ATTACHMENT_SIZE,
  ATTACHMENT_ACCEPT,
  attachmentKind,
} from '@/app/lib/attachments';
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
import { takvimiAc } from '@/app/lib/tarih-girdisi';
import { BriefAlanlari } from '@/app/components/brief/brief-alanlari';
import {
  BRIEF_ACIKLAMA_SONEKI,
  BRIEF_ESNEK_SONEKI,
  briefIlAlani,
} from '@/app/lib/brief-anahtarlari';
import type { Il } from '@/app/components/ui/il-secici';
import { useProfilIslem } from './profil-islem-baglami';

type Props = {
  professionalId: string;
  professionalName: string;
  categorySlug: string | null;
  isLoggedIn: boolean;
  currentUserIsProfessional: boolean;
  isOwnProfile: boolean;
  writableBusinesses?: OnBehalfBusiness[];
  packageContext?: { title: string; price: string | null } | null;
  serviceContext?: {
    title: string;
    addons: { title: string; price: number }[];
    estimatedTotal: number | null;
  } | null;
  variant?: 'default' | 'package' | 'inline' | 'primary-accent';
  /** FAZ 4c/P3: etkinlikten gelindiyse events.id — sohbet o etkinlige baglanir. */
  etkinlikId?: string | null;
  /**
   * D2 — fiyat/takvim kartindan gelen on-doldurma.
   *
   * Kategori brief formunda KARSILIGI OLAN alan varsa (ornek `event_date`)
   * o alan doldurulur; karsiligi olmayan bilgi mesaj metninin basina tek
   * satir olarak yazilir. Form alanlari ve gonderim action'i DEGISMEZ.
   */
  /**
   * Duzeltme 10-D: il secici verisi.  bos gelirse konum alani il
   * SECICISI olarak cizilir ama liste bos kalir — cagiran listeyi gecmeli.
   */
  iller?: Il[];
  saglayiciIli?: string | null;
  yalnizKendiSehri?: boolean;
  /**
   * Duzeltme 10-F3: saglayicinin paket ve hizmet BASLIKLARI. Dolu gelirse
   * formun basinda istege bagli "Hangi hizmet ya da paket?" secimi cizilir;
   * secim `brief_data.hizmet` olarak kaydedilir (ozet etiketi "Seçilen hizmet").
   */
  hizmetSecenekleri?: string[];
  /**
   * Duzeltme 10-F4: saglayici bir AJANS kurulusu mu? Brief alanlari varsayilan
   * bes soruya duser ve intro ajansa gore yazilir.
   */
  ajansMi?: boolean;
  onDolgu?: {
    tarih?: string | null;
    sehir?: string | null;
    kisi?: number | null;
  } | null;
};

export function IletisimButton({
  professionalId,
  professionalName,
  categorySlug,
  isLoggedIn,
  currentUserIsProfessional,
  isOwnProfile,
  writableBusinesses = [],
  packageContext = null,
  serviceContext = null,
  variant = 'default',
  etkinlikId = null,
  iller = [],
  saglayiciIli = null,
  yalnizKendiSehri = false,
  hizmetSecenekleri = [],
  ajansMi = false,
  onDolgu = null,
}: Props) {
  // FAZ 10b: etkinlik turleri `event_types` tablosundan (saglayici).
  const etkinlikTurleriListesi = useEtkinlikTurleri();
  const router = useRouter();
  // Pro-as-buyer: her ziyaretçi (professional dahil) kendi adına — customer koltuğu — teklif isteyebilir.
  const canSelfCreate = true;
  const [onBehalfBusinessId, setOnBehalfBusinessId] = useState<string | null>(
    canSelfCreate ? null : writableBusinesses[0]?.business_id ?? null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [message, setMessage] = useState('');
  // Dinamik brief cevapları: { [field.key]: value }
  const [briefValues, setBriefValues] = useState<Record<string, string>>({});
  /**
   * Duzeltme 10-F3: secilen hizmet / paket basligi. Satirdan gelindiyse
   * (`packageContext` / `serviceContext`) SECILI baslar; kart uzerindeki genel
   * "Teklif Al"da bos baslar ve kullanici isterse secer.
   */
  const secilenBaslangic =
    packageContext?.title ?? serviceContext?.title ?? '';
  const [secilenHizmet, setSecilenHizmet] = useState(secilenBaslangic);

  // Bu profesyonelin kategorisine göre alanlar (config-driven)
  // FAZ 10b: `event_type` secenekleri `event_types` tablosundan (saglayici).
  /**
   * Duzeltme 10-F4 (bulgu 76 a): AJANS brief'i kategori-ozel sorular SORMAZ
   — ajans bir rolu degil etkinligin tamamini ustleniyor. Slug gecilmeyince
   * `getBriefFields` varsayilan bes soruyu (`DEFAULT_BRIEF_FIELDS`) dondurur;
   * intro da ajansa gore yazilir.
   */
  const briefFields: BriefField[] = getBriefFields(
    ajansMi ? null : categorySlug,
    etkinlikTurleriListesi
  );
  const briefIntro = ajansMi
    ? `Etkinliğinin detaylarını paylaş, ${professionalName} sana uygun bir teklif hazırlasın.`
    : getBriefIntro(categorySlug);

  /**
   * On dolgu kaynagi (Duzeltme 10 incelemesi): cagiran `onDolgu` vermediyse
   * profil sayfasinin ortak baglami (kartta secilen tarih / il / kisi) okunur.
   * Hizmet / paket satirindaki dugmeler de boylece kart secimini tasir.
   * Profil disinda (etkinlik aday paneli) baglam bos doner — etkisiz.
   */
  const profilBaglami = useProfilIslem();
  const dolguKaynagi =
    onDolgu ??
    (profilBaglami.tarih || profilBaglami.sehir || profilBaglami.kisi != null
      ? {
          tarih: profilBaglami.tarih,
          sehir: profilBaglami.sehir,
          kisi: profilBaglami.kisi,
        }
      : null);

  function setField(key: string, value: string) {
    setBriefValues((prev) => ({ ...prev, [key]: value }));
  }


  /**
   * D2 — kartta girilen tarih/sehir/kisi bilgisini modala tasir.
   *
   * Brief formunda ayni anlamda bir alan varsa ONU doldurur (kullanici ayni
   * seyi iki kez yazmasin); yoksa mesajin basina tek satir koyar.
   */
  function dolguyuUygula() {
    if (!dolguKaynagi) return;
    const { tarih, sehir, kisi } = dolguKaynagi;
    if (!tarih && !sehir && kisi == null) return;

    const yama: Record<string, string> = {};
    const mesajParcalari: string[] = [];

    const alanVar = (anahtar: string) =>
      briefFields.some((f) => f.key === anahtar);

    if (tarih) {
      if (alanVar('event_date')) yama.event_date = tarih;
      else {
        // ISO degil okunur tarih: "Tarih: 14 Mayis 2027".
        const d = new Date(`${tarih}T12:00:00`);
        mesajParcalari.push(
          `Tarih: ${
            isNaN(d.getTime())
              ? tarih
              : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
          }`
        );
      }
    }
    if (sehir) {
      // Brief formlarinda sehir alani `location` ("Sehir / mekan"); eski
      // kategorilerde `city` olabilir — ikisine de bakilir.
      const sehirAnahtari = ['location', 'city'].find(alanVar);
      if (sehirAnahtari) yama[sehirAnahtari] = sehir;
      else mesajParcalari.push(`Şehir: ${sehir}`);
    }
    if (kisi != null) {
      if (alanVar('guest_count')) yama.guest_count = String(kisi);
      else mesajParcalari.push(`${kisi} kişi`);
    }

    if (Object.keys(yama).length > 0) {
      setBriefValues((onceki) => ({ ...onceki, ...yama }));
    }
    if (mesajParcalari.length > 0) {
      const satir = mesajParcalari.join(" · ");
      setMessage((onceki) =>
        onceki.startsWith(satir) ? onceki : `${satir}

${onceki}`
      );
    }
  }

  // Paket veya hizmet+ekstra için iletişim: modalı açarken mesajı ön-doldur
  function openForPackage() {
    if (packageContext) {
      const priceText = packageContext.price
        ? ` (${packageContext.price})`
        : '';
      setMessage(
        `Merhaba, "${packageContext.title}"${priceText} paketiniz hakkında bilgi almak istiyorum. `
      );
    } else if (serviceContext) {
      const { title, addons, estimatedTotal } = serviceContext;
      if (addons.length > 0) {
        const addonLines = addons
          .map(
            (a) =>
              `• ${a.title}${a.price > 0 ? ` (+${formatTL(a.price)})` : ''}`
          )
          .join('\n');
        const totalText =
          estimatedTotal !== null
            ? `\n\nTahmini toplam: ~${formatTL(estimatedTotal)}`
            : '';
        setMessage(
          `Merhaba, "${title}" hizmetiniz için aşağıdaki ekstralarla ilgileniyorum:\n${addonLines}${totalText}\n\n`
        );
      } else {
        setMessage(
          `Merhaba, "${title}" hizmetiniz hakkında bilgi almak istiyorum. `
        );
      }
    }
    dolguyuUygula();
    setModalOpen(true);
  }

  // Body scroll lock
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [modalOpen]);

  // ESC ile kapat
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  // Bugünün tarihi — date input'un min değeri için
  const todayStr = new Date().toISOString().split('T')[0];

  // MODEL A — Otomatik gönderim:
  // Kullanıcı anonimken brief doldurup kayda yönlendirildiyse, kayıt/giriş
  // sonrası bu profile döndüğünde sessionStorage'daki brief'i otomatik gönder.
  useEffect(() => {
    // Giriş yapmış her alıcı için çalışır (pro-as-buyer dahil); yalnız kendi profilinde değil.
    if (!isLoggedIn || isOwnProfile) return;

    const key = `kashe_pending_brief_${professionalId}`;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(key);
    } catch {
      return;
    }
    if (!stored) return;

    let payload: Parameters<typeof startConversation>[0] | null = null;
    try {
      payload = JSON.parse(stored);
    } catch {
      // Bozuk veri — temizle ve çık
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* yoksay */
      }
      return;
    }

    // Güvenlik: payload'daki professional_id bu sayfayla eşleşmeli
    if (!payload || payload.professional_id !== professionalId) return;

    // Tekrar gönderimi önlemek için ÖNCE temizle, sonra gönder
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* yoksay */
    }

    startTransition(async () => {
      const result = await startConversation(payload!);
      if (result.success && result.conversationId) {
        router.push(`/mesajlar/${result.conversationId}`);
      } else {
        // Gönderim başarısızsa modalı açıp kullanıcıya göster —
        // veri kaybı olmasın diye brief'i forma geri yükle
        if (payload!.brief_data) {
          setBriefValues(payload!.brief_data as Record<string, string>);
        }
        setMessage(payload!.message || '');
        setError(
          result.error ||
            'Talebin otomatik gönderilemedi. Lütfen tekrar dene.'
        );
        setModalOpen(true);
      }
    });
    // professionalId değişmez (sayfa başına sabit), sadece mount'ta çalışsın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, professionalId]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setError(null);
    if (!attachmentKind(file.type)) {
      setError(
        'Desteklenmeyen dosya tipi. Görsel, PDF veya Word gönderebilirsin.'
      );
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError("Dosya 20 MB'dan büyük olamaz.");
      return;
    }
    setSelectedFile(file);
  }

  function removeFile() {
    setSelectedFile(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // "Yalnizca kendi sehri" saglayicida il secici kilitli ili GOSTERIR ama
    // kullanici dokunmadiysa alan bos kalir; gonderimde saglayicinin iline
    // tamamlanir (Duzeltme 10 incelemesi).
    const degerler: Record<string, string> = { ...briefValues };
    if (yalnizKendiSehri && saglayiciIli) {
      for (const f of briefFields) {
        if (briefIlAlani(f) && !(degerler[f.key] ?? '').trim()) {
          degerler[f.key] = saglayiciIli;
        }
      }
    }

    // Zorunlu alan kontrolü (config'de required: true olanlar).
    // Duzeltme 10-E2: tarih alani "henuz belli degil" isaretliyse zorunluluk
    // KALKAR; E3: "Diger" secildiyse aciklama ZORUNLU olur.
    for (const f of briefFields) {
      const esnek = (degerler[`${f.key}${BRIEF_ESNEK_SONEKI}`] ?? '') === '1';
      const zorunlu = f.required && !(f.type === 'date' && esnek);
      if (zorunlu && !(degerler[f.key] && degerler[f.key].trim())) {
        setError(`"${f.label}" alanı zorunlu.`);
        return;
      }
      if (f.type === 'select' && degerler[f.key] === 'other') {
        const aciklama = (
          degerler[`${f.key}${BRIEF_ACIKLAMA_SONEKI}`] ?? ''
        ).trim();
        if (!aciklama) {
          setError(`"${f.label} - kısaca yaz" alanı zorunlu.`);
          return;
        }
      }
    }

    // Legacy kolonları config'deki legacyColumn işaretine göre ayır
    let legacyEventType: string | null = null;
    let legacyEventDate: string | null = null;
    let legacyLocation: string | null = null;
    let legacyGuestCount: number | null = null;
    let legacyBudget: string | null = null;

    for (const f of briefFields) {
      const raw = degerler[f.key]?.trim();
      if (!raw || !f.legacyColumn) continue;
      switch (f.legacyColumn) {
        case 'event_type':
          legacyEventType = raw;
          break;
        case 'event_date':
          legacyEventDate = raw;
          break;
        case 'location':
          legacyLocation = raw;
          break;
        case 'guest_count': {
          const n = parseInt(raw, 10);
          if (isNaN(n) || n < 0) {
            setError('Kişi sayısı geçersiz.');
            return;
          }
          legacyGuestCount = n;
          break;
        }
        case 'budget_range':
          legacyBudget = raw;
          break;
      }
    }

    // brief_data: boş olmayan tüm cevaplar.
    // Duzeltme 10-E: alan basina EK anahtarlar da tasinir
    // (`<key>_aciklama` metin, `<key>_esnek` mantiksal) — sunucu
    // `briefVeriTemizle` ile tipi ve uzunlugu sabitler.
    const cleanBrief: Record<string, string> = {};
    for (const f of briefFields) {
      const raw = degerler[f.key]?.trim();
      if (raw) cleanBrief[f.key] = raw;
      const aciklama = degerler[`${f.key}${BRIEF_ACIKLAMA_SONEKI}`]?.trim();
      if (aciklama) cleanBrief[`${f.key}${BRIEF_ACIKLAMA_SONEKI}`] = aciklama;
      const esnek = degerler[`${f.key}${BRIEF_ESNEK_SONEKI}`];
      if (esnek === '1') cleanBrief[`${f.key}${BRIEF_ESNEK_SONEKI}`] = '1';
    }
    // Duzeltme 10-F3: secilen hizmet / paket (ozet etiketi "Seçilen hizmet").
    if (secilenHizmet.trim()) cleanBrief.hizmet = secilenHizmet.trim();

    // Brief payload — hem giriş yapan hem anonim için aynı veri
    const payload = {
      professional_id: professionalId,
      message: message.trim(),
      event_date: legacyEventDate,
      event_type: legacyEventType,
      location: legacyLocation,
      guest_count: legacyGuestCount,
      budget_range: legacyBudget,
      brief_data: Object.keys(cleanBrief).length > 0 ? cleanBrief : null,
      on_behalf_business_id: onBehalfBusinessId,
      // Etkinlikten gelindiyse bag tasinir; sunucu id'yi RLS ile dogrular.
      event_id: etkinlikId,
    };

    // ANONİM AKIŞ (Model A): brief'i sessionStorage'a yaz, kayda yönlendir.
    // Kayıt/giriş sonrası profil sayfasına dönünce otomatik gönderilecek (Adım 4).
    if (!isLoggedIn) {
      try {
        sessionStorage.setItem(
          `kashe_pending_brief_${professionalId}`,
          JSON.stringify(payload)
        );
      } catch {
        // sessionStorage erişilemezse sessizce devam — kayıt sonrası kullanıcı
        // brief'i tekrar doldurur (graceful degradation).
      }
      router.push(`/uye-ol?redirect=/p/${professionalId}`);
      return;
    }

    // GİRİŞ YAPMIŞ AKIŞ: doğrudan gönder (+ varsa dosyayı ikinci mesaj olarak)
    startTransition(async () => {
      const result = await startConversation(payload);

      if (!result.success || !result.conversationId) {
        setError(result.error || 'Bir hata oluştu.');
        return;
      }

      const convId = result.conversationId;

      // Dosya seçildiyse: konuşma açıldıktan sonra eki yükle + ayrı mesaj gönder.
      // Hata olursa sessizce geç — metin mesajı zaten iletildi.
      if (selectedFile) {
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const kind = attachmentKind(selectedFile.type);
          if (user && kind) {
            const ext =
              selectedFile.name.split('.').pop()?.toLowerCase() || 'bin';
            const path = `${user.id}/${convId}/${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 8)}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('message-attachments')
              .upload(path, selectedFile, {
                cacheControl: '3600',
                upsert: false,
              });
            if (!upErr) {
              await sendMessageWithAttachment(
                convId,
                { path, type: kind, name: selectedFile.name },
                ''
              );
            }
          }
        } catch {
          /* ek başarısız — konuşma yine de açıldı */
        }
      }

      router.push(`/mesajlar/${convId}`);
    });
  }

  // Kendi profili
  if (isOwnProfile) {
    return (
      <div className="bg-paper border border-line rounded-lg p-6">
        <p className="text-ink-72 text-sm">
          Bu senin profilin. Müşteriler buradan sana mesaj gönderebilir.
        </p>
      </div>
    );
  }


  // Login + müşteri → İletişim butonu (varyanta göre: package=sade buton, inline=tek buton kutusuz, default=kutu)
  return (
    <>
      {variant === 'package' ? (
        <button
          type="button"
          onClick={openForPackage}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink-blue text-white rounded-lg font-display font-semibold text-sm hover:bg-ink-blue-deep hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
        >
          {serviceContext
            ? serviceContext.addons.length > 0
              ? 'Seçili ekstralarla teklif al'
              : 'Bu hizmet için teklif al'
            : 'Bu paket için teklif al'}
        </button>
      ) : variant === 'primary-accent' ? (
        <button
          type="button"
          onClick={() => {
            dolguyuUygula();
            setModalOpen(true);
          }}
          className="w-full py-3.5 bg-brand-accent text-white rounded-xl font-display font-semibold text-[15px] hover:bg-[#D50880] transition-colors text-center"
        >
          Teklif Al
        </button>
      ) : variant === 'inline' ? (
        <button
          type="button"
          onClick={() => {
            dolguyuUygula();
            setModalOpen(true);
          }}
          className="flex-1 px-5 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] transition-all text-center"
        >
          Teklif Al
        </button>
      ) : (
        <div className="bg-brand-ink/8 border border-brand-ink/20 rounded-lg p-6 md:p-8">
          <h2 className="font-display text-xl text-ink mb-2">Talep gönder</h2>
          <p className="text-ink-72 text-sm mb-4">
            Etkinlik detaylarını paylaş, profesyonel sana daha hızlı ve doğru yanıt versin.
          </p>
          <button
            type="button"
            onClick={() => {
              dolguyuUygula();
              setModalOpen(true);
            }}
            className="px-6 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] transition-all"
          >
            Talep gönder
          </button>
        </div>
      )}

      {/* Modal — portal ile body'ye; sticky rail / fixed CTA stacking context'inden cikar */}
      {modalOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />

          <div
            className="relative bg-paper rounded-lg shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-display text-xl text-ink">
                <em className="text-brand-ink not-italic italic font-medium">
                  {professionalName}
                </em>
                {' '}için teklif talebi
                {secilenHizmet && (
                  <span className="block text-sm font-body text-ink-72 mt-0.5">
                    Seçilen: {secilenHizmet}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-ink-72 hover:text-ink p-2 -mr-2 transition-colors"
                aria-label="Kapat"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Kimin adına (manager+ kurum üyesine görünür) */}
              {writableBusinesses.length > 0 && (
                <OnBehalfSelector
                  businesses={writableBusinesses}
                  canSelfCreate={canSelfCreate}
                  value={onBehalfBusinessId}
                  onChange={setOnBehalfBusinessId}
                />
              )}

              {/* Duzeltme 10-F3: hangi hizmet / paket? (istege bagli) */}
              {hizmetSecenekleri.length > 0 && (
                <div>
                  <label
                    htmlFor="brief-hizmet-secimi"
                    className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2"
                  >
                    Hangi hizmet ya da paket?
                  </label>
                  <select
                    id="brief-hizmet-secimi"
                    value={secilenHizmet}
                    onChange={(e) => setSecilenHizmet(e.target.value)}
                    className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
                  >
                    <option value="">Henüz bilmiyorum</option>
                    {hizmetSecenekleri.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* SECTION: Etkinlik detayları */}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                  Etkinlik detayları
                </p>
                {briefIntro && (
                  <p className="text-sm text-ink-72 mb-4 -mt-1">{briefIntro}</p>
                )}

                {/* Duzeltme 10-D/E: alanlar ORTAK cizicide — il secici,
                    "Tarih henuz belli degil" ve "Diger" aciklamasi tek yerde
                    (ayni cizici `/teklif-topla` formunda da kullaniliyor). */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <BriefAlanlari
                    alanlar={briefFields}
                    degerler={briefValues}
                    setAlan={setField}
                    bugun={todayStr}
                    iller={iller}
                    saglayiciIli={saglayiciIli}
                    yalnizKendiSehri={yalnizKendiSehri}
                  />
                </div>

                <p className="text-xs text-ink-72 mt-3">
                  Yıldızlı (*) alanlar zorunlu — diğerlerini bildiğin kadar doldur.
                </p>
              </div>

              {/* SECTION: Mesaj */}
              <div className="pt-4 border-t border-line">
                <label htmlFor="message" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Mesajın <span className="text-danger">*</span>
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none"
                  placeholder="Merhaba, etkinliğim için sizden bilgi almak istiyorum. Düşündüğüm konseptten kısaca bahsetmem gerekirse..."
                />
                <p className="text-xs text-ink-72 mt-1.5">
                  {message.length}/2000 karakter
                </p>
              </div>

              {/* SECTION: Dosya eki (opsiyonel) */}
              {isLoggedIn && (
                <div className="pt-4 border-t border-line">
                  <p className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                    Dosya ekle{' '}
                    <span className="text-ink-72/60 normal-case tracking-normal">
                      (opsiyonel)
                    </span>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    onChange={handleFileSelected}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-2.5 rounded-lg border border-line bg-card px-3 py-2.5">
                      <span className="shrink-0 w-9 h-9 rounded-lg bg-brand-ink/10 flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-ink)" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-ink truncate">
                        {selectedFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="shrink-0 text-ink-72 hover:text-brand-ink transition-colors p-1"
                        aria-label="Dosyayı kaldır"
                      >
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 border border-line rounded-lg text-sm text-ink-72 hover:text-brand-ink hover:border-brand-ink transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Dosya seç
                    </button>
                  )}
                  <p className="text-xs text-ink-72 mt-2">
                    Görsel, PDF veya Word · en fazla 20 MB
                  </p>
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="px-5 py-2.5 text-ink-72 hover:text-ink font-display font-medium transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !message.trim()}
                  className="px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isPending ? 'Gönderiliyor...' : 'Talebi gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}