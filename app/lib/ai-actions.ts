'use server';

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/app/lib/supabase-server';
import {
  EVENTSPEC_SCHEMA_VERSION,
  EVENT_NEEDS_MODEL_ID,
  EVENT_NEEDS_PARSER_VERSION,
  EVENT_NEEDS_PROMPT_VERSION,
  normalizeTr,
  type EventSpecProvenance,
  type EventSpecProvenanceEntry,
  type EventSpecV1,
  type EventSpecValidationStatus,
} from '@/app/lib/eventspec';

type AIResult =
  | { success: true; text: string }
  | { success: false; error: string };

export type EventNeedSuggestion = {
  slug: string;
  name: string;
  reason: string;
};

export type EventAnalysisResult =
  | {
      success: true;
      categories: EventNeedSuggestion[];
      tip: string;
      /**
       * FAZ 4c/P1: kaydedilen EventSpec ve provenance (kayit basarisiz olsa da doner).
       * P2 sihirbazi formu bunlarla on doldurur; `/etkinlik-planla` kullanmaz.
       */
      spec: EventSpecV1;
      provenance: EventSpecProvenance;
      /** FAZ 4b: EventSpec kaydi — 4c bunlari events.brief_id / spec_version_id icin kullanir. */
      briefId?: string;
      specVersionId?: string;
    }
  | { success: false; error: string };

export type ProMatch = {
  id: string;
  name: string;
  reason: string;
};

export type ProMatchResult =
  | { success: true; matches: ProMatch[] }
  | { success: false; error: string };

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

/**
 * İlan açıklaması üretir. Kullanıcının girdiği başlık + kategori + anahtar
 * kelimelerden, Kashe'ye uygun, profesyonel bir ilan metni yazar.
 * Çıktı düz metin — kullanıcı düzenleyebilir.
 */
export async function generateListingDescription(input: {
  title: string;
  categoryName: string;
  keywords: string;
}): Promise<AIResult> {
  // Giriş kontrolü (suspension dahil)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  if (!anthropic) {
    return {
      success: false,
      error: 'AI servisi şu an kullanılamıyor.',
    };
  }

  const title = input.title.trim().slice(0, 200);
  const category = input.categoryName.trim().slice(0, 100);
  const keywords = input.keywords.trim().slice(0, 500);

  if (title.length < 3 && keywords.length < 3) {
    return {
      success: false,
      error: 'Önce ilan başlığını yaz veya birkaç anahtar kelime gir.',
    };
  }

  const prompt = `Sen Kashe adlı bir etkinlik ve yetenek pazaryeri için ilan metni yazan bir asistansın. Kashe'de müşteriler etkinlikleri için profesyonel (DJ, fotoğrafçı, sunucu, müzisyen vb.) arıyor.

Bir müşteri ilan açıyor. Aşağıdaki bilgilerden, o ilan için akıcı, samimi ama profesyonel bir AÇIKLAMA metni yaz:

İlan başlığı: ${title || '(belirtilmemiş)'}
Aranan kategori: ${category || '(belirtilmemiş)'}
Müşterinin notları/anahtar kelimeler: ${keywords || '(yok)'}

Kurallar:
- Türkçe yaz.
- 2-4 kısa paragraf, toplam 80-150 kelime.
- Profesyonellerin başvurmak isteyeceği, net ve davetkar bir dil kullan.
- Etkinliğin ne olduğunu, ne tür bir profesyonel arandığını ve varsa beklentileri belirt.
- Uydurma detay EKLEME (kesin tarih, bütçe, yer gibi bilgiler verilmediyse uydurma).
- Başlık veya "Açıklama:" gibi etiketler ekleme, doğrudan metni yaz.
- Abartılı pazarlama dili ve emoji kullanma.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const text =
      textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

    if (!text) {
      return { success: false, error: 'Metin üretilemedi, tekrar dene.' };
    }

    return { success: true, text };
  } catch (err) {
    console.error('[ai] generateListingDescription error:', err);
    return {
      success: false,
      error: 'AI metni oluştururken bir sorun oluştu, tekrar dene.',
    };
  }
}

/**
 * Profil "Hakkımda" (bio) metni üretir. Profesyonel/ajansın kategorisinden +
 * anahtar kelimelerinden, 1. tekil/çoğul şahıs tanıtım metni yazar.
 * Çıktı düz metin — kullanıcı düzenleyebilir.
 */
export async function generateProfileBio(input: {
  categoryName: string;
  keywords: string;
  isAgency: boolean;
}): Promise<AIResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  if (!anthropic) {
    return { success: false, error: 'AI servisi şu an kullanılamıyor.' };
  }

  const category = input.categoryName.trim().slice(0, 100);
  const keywords = input.keywords.trim().slice(0, 500);

  if (category.length < 2 && keywords.length < 3) {
    return {
      success: false,
      error: 'Önce kategorini seç veya birkaç anahtar kelime gir.',
    };
  }

  const voice = input.isAgency
    ? 'Birinci çoğul şahıs ("biz", "ekibimiz", "sunuyoruz") kullan — bu bir ajans/ekip.'
    : 'Birinci tekil şahıs ("ben", "sunuyorum", "deneyimim") kullan — bu bireysel bir profesyonel.';

  const prompt = `Sen Kashe adlı etkinlik ve yetenek pazaryeri için profil tanıtım metni yazan bir asistansın. Kashe'de profesyoneller (DJ, fotoğrafçı, sunucu, müzisyen vb.) müşterilere hizmet veriyor.

Bir profesyonel/ajans kendi profilindeki "Hakkımda" metnini yazmak istiyor. Aşağıdaki bilgilerden akıcı, güven veren, profesyonel bir tanıtım metni yaz:

Hizmet kategorisi: ${category || '(belirtilmemiş)'}
Kişinin notları/anahtar kelimeler: ${keywords || '(yok)'}

Kurallar:
- Türkçe yaz.
- ${voice}
- 2-3 cümle veya kısa bir paragraf, toplam 40-80 kelime (en fazla 500 karakter).
- Müşterinin güvenini kazanacak, neden bu kişiyle çalışması gerektiğini hissettiren bir dil kullan.
- Deneyim, tarz ve sunulan hizmetin değerini vurgula.
- Uydurma detay EKLEME (kesin yıl, ödül, müşteri sayısı verilmediyse uydurma).
- Başlık veya "Hakkımda:" gibi etiketler ekleme, doğrudan metni yaz.
- Abartılı pazarlama dili ve emoji kullanma.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const text =
      textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

    if (!text) {
      return { success: false, error: 'Metin üretilemedi, tekrar dene.' };
    }

    return { success: true, text };
  } catch (err) {
    console.error('[ai] generateProfileBio error:', err);
    return {
      success: false,
      error: 'AI metni oluştururken bir sorun oluştu, tekrar dene.',
    };
  }
}

/**
 * Hizmet açıklaması üretir. Hizmetin başlığından + anahtar kelimelerden,
 * müşteriyi ikna eden, neyi kapsadığını anlatan kısa bir tanıtım yazar.
 * Çıktı düz metin — kullanıcı düzenleyebilir.
 */
export async function generateServiceDescription(input: {
  serviceTitle: string;
  keywords: string;
}): Promise<AIResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  if (!anthropic) {
    return { success: false, error: 'AI servisi şu an kullanılamıyor.' };
  }

  const serviceTitle = input.serviceTitle.trim().slice(0, 100);
  const keywords = input.keywords.trim().slice(0, 500);

  if (serviceTitle.length < 3 && keywords.length < 3) {
    return {
      success: false,
      error: 'Önce hizmet başlığını yaz veya birkaç anahtar kelime gir.',
    };
  }

  const prompt = `Sen Kashe adlı etkinlik ve yetenek pazaryeri için hizmet açıklaması yazan bir asistansın. Kashe'de profesyoneller (DJ, fotoğrafçı, sunucu, müzisyen vb.) sundukları hizmetleri listeliyor.

Bir profesyonel, sunduğu bir hizmet için açıklama yazmak istiyor. Aşağıdaki bilgilerden, müşteriyi ikna eden, hizmetin neyi kapsadığını net anlatan bir açıklama yaz:

Hizmet başlığı: ${serviceTitle || '(belirtilmemiş)'}
Profesyonelin notları/anahtar kelimeler: ${keywords || '(yok)'}

Kurallar:
- Türkçe yaz.
- Birinci tekil/çoğul şahıs ("sunuyorum", "paketimde") kullan — hizmeti veren profesyonelin ağzından.
- 2-3 cümle veya kısa bir paragraf, toplam 40-90 kelime (en fazla 1000 karakter).
- Bu hizmette müşterinin tam olarak ne alacağını (kapsam, süre, dahil olanlar) net belirt.
- Müşterinin tercih etmesini sağlayacak, güven veren ve somut bir dil kullan.
- Uydurma detay EKLEME (verilmeyen fiyat, süre, ekipman gibi şeyleri uydurma).
- Başlık veya "Hakkımda:" gibi etiketler ekleme, doğrudan metni yaz.
- Abartılı pazarlama dili ve emoji kullanma.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const text =
      textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

    if (!text) {
      return { success: false, error: 'Metin üretilemedi, tekrar dene.' };
    }

    return { success: true, text };
  } catch (err) {
    console.error('[ai] generateProfileBio error:', err);
    return {
      success: false,
      error: 'AI metni oluştururken bir sorun oluştu, tekrar dene.',
    };
  }
}
/**
 * Müşterinin etkinlik tarifinden, hangi hizmet kategorilerine ihtiyacı
 * olduğunu + ipucu önerir. Fiyat/bütçe ÜRETİLMEZ (kilitli karar). Claude'a SADECE gerçek kategori
 * listesi verilir; uydurma kategori önermez. Çıktı JSON olarak parse edilir.
 */
export async function analyzeEventNeeds(input: {
  eventDescription: string;
  categories: { slug: string; name_tr: string }[];
}): Promise<EventAnalysisResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  if (!anthropic) {
    return { success: false, error: 'AI servisi şu an kullanılamıyor.' };
  }

  const description = input.eventDescription.trim().slice(0, 1000);
  if (description.length < 10) {
    return {
      success: false,
      error: 'Lütfen etkinliğini biraz daha anlat (en az birkaç kelime).',
    };
  }

  // ── FAZ 4b — EventSpec kaydi (Event AI altin kumesinin kaynagi) ──────────────
  // Kayit kullanici akisini HICBIR zaman kesmez: her iki INSERT de hatayi yalniz
  // log'a yazar, analiz normal devam eder. organization_id GONDERILMEZ (kurulus
  // atfi 4c). Her cagri YENI brief acar; surumleme 4c'deki "duzelt" akisiyla gelir.
  let briefId: string | null = null;
  try {
    const { data: brief, error: briefErr } = await supabase
      .from('event_briefs')
      .insert({
        created_by_user_id: user.id,
        source: 'client_web',
        raw_text: description,
      })
      .select('id')
      .single();
    if (briefErr) {
      console.error('[eventspec] brief kaydi', briefErr);
    } else {
      briefId = (brief as { id: string } | null)?.id ?? null;
    }
  } catch (err) {
    console.error('[eventspec] brief kaydi', err);
  }

  /**
   * Surum satiri yazar. `version_no` ve `is_current` GONDERILMEZ (BEFORE INSERT
   * tetikleyicisi verir), `created_by_user_id` de gonderilmez (tetikleyici auth.uid()
   * yazar). Tablo ekle-yalniz: duzeltme = yeni surum.
   */
  async function specSurumuYaz(
    spec: EventSpecV1,
    provenance: EventSpecProvenance,
    validationStatus: EventSpecValidationStatus
  ): Promise<string | undefined> {
    if (!briefId) return undefined;
    try {
      const { data, error } = await supabase
        .from('event_spec_versions')
        .insert({
          brief_id: briefId,
          spec_jsonb: spec,
          provenance,
          schema_version: EVENTSPEC_SCHEMA_VERSION,
          parser_version: EVENT_NEEDS_PARSER_VERSION,
          model_id: EVENT_NEEDS_MODEL_ID,
          prompt_version: EVENT_NEEDS_PROMPT_VERSION,
          validation_status: validationStatus,
        })
        .select('id')
        .single();
      if (error) {
        console.error('[eventspec] surum kaydi', error);
        return undefined;
      }
      return (data as { id: string } | null)?.id ?? undefined;
    } catch (err) {
      console.error('[eventspec] surum kaydi', err);
      return undefined;
    }
  }

  /** Uretim/parse hatasi: surum `invalid` + `extra.error` (altin kume icin saklanir). */
  async function hataSurumuYaz(neden: string): Promise<void> {
    await specSurumuYaz({ extra: { error: neden } }, {}, 'invalid');
  }

  // ── FAZ 4c/P1 — referans verisi (yapisal cikarim icin) ──────────────────────
  // Ikisi de kullanici oturumuyla okunur (RLS herkese acik). Sorgu hatasi analizi
  // KESMEZ: liste bos kalir ve ilgili alan cikarilmaz (tur listesi bos -> event_type
  // yazilmaz; sehir listesi bos -> city_id yazilmaz), roller ve tip aynen calisir.
  let eventTypes: { key: string; name_tr: string }[] = [];
  let cities: { id: number; name: string }[] = [];
  try {
    const [
      { data: turData, error: turErr },
      { data: sehirData, error: sehirErr },
    ] = await Promise.all([
      supabase
        .from('event_types')
        .select('key, name_tr')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('turkish_cities').select('id, name').order('name'),
    ]);
    if (turErr) console.error('[eventspec] referans', turErr);
    if (sehirErr) console.error('[eventspec] referans', sehirErr);
    eventTypes = (turData as { key: string; name_tr: string }[] | null) ?? [];
    cities = (sehirData as { id: number; name: string }[] | null) ?? [];
  } catch (err) {
    console.error('[eventspec] referans', err);
  }

  // Tarih ifadeleri bu güne göre çözülür (kullanıcı saat dilimi değil, ürünün saati).
  const bugun = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
  }).format(new Date());

  // Geçerli kategori listesi — Claude sadece bunlardan seçecek
  const validSlugs = new Set(input.categories.map((c) => c.slug));
  const categoryList = input.categories
    .map((c) => `- ${c.name_tr} (slug: ${c.slug})`)
    .join('\n');

  // Etkinlik türü listesi (prompt p2). Liste boşsa tür alanı hiç sorulmaz.
  const turListesi = eventTypes
    .map((t) => `- ${t.name_tr} (key: ${t.key})`)
    .join('\n');
  const turBlogu = turListesi
    ? `
Etkinlik türü için SADECE şu key'ler geçerli. Metne uyan key'i seç; hiçbiri uymuyorsa "other", emin değilsen null:
${turListesi}
`
    : '';
  const turAlani = turListesi
    ? `  "event_type": { "value": "wedding", "confidence": 0.95, "evidence": "düğün" },
`
    : '';

  const prompt = `Sen Kashe adlı etkinlik ve yetenek pazaryeri için bir etkinlik planlama asistanısın. Müşteriler etkinliklerini anlatıyor, sen onlara hangi profesyonellere/hizmetlere ihtiyaçları olduğunu öneriyorsun.

Bugün: ${bugun} (Europe/Istanbul). Tarih ifadelerini bu tarihe göre çöz.

Müşterinin etkinlik açıklaması:
"${description}"

Kashe'de SADECE şu hizmet kategorileri var. Önerilerini KESİNLİKLE bu listeden seç, listede olmayan bir kategori UYDURMA:
${categoryList}
${turBlogu}
Görevin: Bu etkinlik için en uygun hizmet kategorilerini öner ve metinde açıkça geçen yapısal bilgileri çıkar. Yanıtını SADECE geçerli bir JSON nesnesi olarak ver, başka hiçbir metin, açıklama veya markdown ekleme. JSON yapısı:

{
  "categories": [
    { "slug": "kategori-slug", "name": "Kategori Adı", "reason": "Bu etkinlik için neden gerekli olduğunu açıklayan 1 kısa cümle" }
  ],
  "tip": "Müşteriye etkinliğiyle ilgili 1-2 cümlelik faydalı bir ipucu",
${turAlani}  "title": "kısa başlık (en fazla 80 karakter), örnek: İstanbul'da 120 kişilik düğün",
  "city_name": { "value": "İstanbul", "confidence": 0.9, "evidence": "İstanbul'da" },
  "district": { "value": "Kadıköy", "confidence": 0.8, "evidence": "Kadıköy'de" },
  "start_date": { "value": "YYYY-MM-DD", "confidence": 0.6, "evidence": "15 Haziran", "inferred": true },
  "end_date": { "value": "YYYY-MM-DD", "confidence": 0.6, "evidence": "3 gün sürecek" },
  "date_note": "metindeki tarih ifadesi, gün belli değilse (örnek: Haziran, yaz ayları, hafta sonu)",
  "is_date_flexible": { "value": true, "confidence": 0.8, "evidence": "tarih esnek" },
  "participant_count": { "value": 120, "confidence": 0.9, "evidence": "120 kişilik" },
  "budget_min": { "value": 50000, "confidence": 0.9, "evidence": "50-80 bin TL" },
  "budget_max": { "value": 80000, "confidence": 0.9, "evidence": "50-80 bin TL" },
  "urgency": { "value": "urgent", "confidence": 0.7, "evidence": "acil" },
  "venue_status": { "value": "confirmed", "confidence": 0.7, "evidence": "mekan belli" }
}

Kurallar:
- Türkçe yaz (slug hariç — slug yukarıdaki listedeki gibi kalsın).
- "categories" içinde 2-5 öneri olsun, en alakalı olanlar. Her slug yukarıdaki listeden BİREBİR olmalı.
- "reason" kısa ve somut olsun.
- "tip" samimi ve işe yarar olsun.
- Yapısal alanlar: yalnız metinde OLAN bilgiyi çıkar; olmayan alan null. "confidence" 0-1 arası; "evidence" metinden kısa alıntı.
- "city_name" İL adıdır (Türkiye'nin 81 ili); metinde yalnız ilçe/semt geçiyorsa bağlı olduğu ili yaz, ilçeyi "district" alanına koy.
- Tarih: metinde GÜN (ayın kaçı) yazmıyorsa "start_date" MUTLAKA null olsun — ayın 1'i gibi bir gün UYDURMA — ve tarih ifadesini "date_note" alanına yaz. Gün yazıyorsa "start_date" doldur; yıl yazılmamışsa bugünden sonraki ilk uygun yılı al ve "inferred": true yaz. Geçmiş tarih üretme. "end_date" yalnız birden çok gün süren etkinlikte.
- Bütçe: YALNIZ metinde açıkça yazılmış tutarı TRY olarak aktar ("50 bin" -> 50000); metinde yoksa null. "reason" ve "tip" içinde fiyat, rakam, para birimi veya bütçe aralığı ÜRETME — fiyatı yalnız profesyonelin kendisi belirler.
- "urgency": metin kısa süre/acil diyorsa "urgent", tarih/plan esnek diyorsa "flexible"; belirtilmemişse null ("normal" yazma).
- "venue_status": mekan belli/ayarlanmış -> "confirmed", mekan aranıyor -> "searching", mekan gerekmiyor -> "not_needed"; belirtilmemişse null.
- "title": metni özetleyen kısa ad; şehir ve tür biliniyorsa onları kullan; uydurma ayrıntı ekleme.
- SADECE JSON döndür, başına/sonuna hiçbir şey ekleme, markdown kod bloğu (üç backtick) kullanma.`;

  try {
    const message = await anthropic.messages.create({
      model: EVENT_NEEDS_MODEL_ID,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    let raw =
      textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

    if (!raw) {
      await hataSurumuYaz('Analiz uretilemedi (bos yanit)');
      return { success: false, error: 'Analiz üretilemedi, tekrar dene.' };
    }

    // Olası markdown kod bloğu sarmasını temizle
    raw = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed: {
      categories?: { slug?: string; name?: string; reason?: string }[];
      tip?: string;
      // parser 1.1 — yapisal alanlar; hepsi ham, dogrulama asagida
      event_type?: unknown;
      title?: unknown;
      city_name?: unknown;
      district?: unknown;
      start_date?: unknown;
      end_date?: unknown;
      date_note?: unknown;
      is_date_flexible?: unknown;
      participant_count?: unknown;
      budget_min?: unknown;
      budget_max?: unknown;
      urgency?: unknown;
      venue_status?: unknown;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      await hataSurumuYaz('Analiz sonucu okunamadi (JSON parse)');
      return {
        success: false,
        error: 'Analiz sonucu okunamadı, tekrar dene.',
      };
    }

    // Sadece geçerli (gerçek) kategorileri al
    const categories: EventNeedSuggestion[] = (parsed.categories ?? [])
      .filter(
        (c): c is { slug: string; name?: string; reason?: string } =>
          typeof c?.slug === 'string' && validSlugs.has(c.slug)
      )
      .map((c) => {
        const real = input.categories.find((rc) => rc.slug === c.slug);
        return {
          slug: c.slug,
          name: real?.name_tr || c.name || c.slug,
          reason: (c.reason || '').trim(),
        };
      });

    if (categories.length === 0) {
      await hataSurumuYaz('Uygun oneri bulunamadi (gecerli slug yok)');
      return {
        success: false,
        error:
          'Etkinliğin için uygun bir öneri bulunamadı. Biraz daha detay ekleyip tekrar dene.',
      };
    }

    const tip = (parsed.tip || '').trim();

    // ── parser 1.1 — yapisal alan suzgeci ─────────────────────────────────────
    // 06 bolum 1: bilinmeyen/dogrulanmayan alan YAZILMAZ (null da yazilmaz);
    // bolum 2: provenance yalniz spec_jsonb'de BULUNAN alanlar icin girdi alir.
    // Suzgec kapali devre calisir: tip/kume/guven esigi tutmuyorsa alan duser.
    const GUVEN_ESIGI = 0.5;
    const spec: EventSpecV1 = {};
    const provenance: EventSpecProvenance = {};
    const extra: Record<string, unknown> = {};

    type HamAlan = {
      value: unknown;
      confidence: number;
      evidence?: string;
      inferred: boolean;
    };

    /** Ham `{ value, confidence, evidence, inferred }` nesnesini cozer; esigi gecmezse null. */
    function hamAlan(ham: unknown): HamAlan | null {
      if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return null;
      const o = ham as Record<string, unknown>;
      if (o.value === null || o.value === undefined) return null;
      const c =
        typeof o.confidence === 'number' ? o.confidence : Number(o.confidence);
      if (!Number.isFinite(c) || c < GUVEN_ESIGI || c > 1) return null;
      return {
        value: o.value,
        confidence: c,
        evidence: typeof o.evidence === 'string' ? o.evidence : undefined,
        inferred: o.inferred === true,
      };
    }

    /** Provenance girdisi; `evidence` ham metinde bulunursa `span` de yazilir. */
    function girdi(
      source: EventSpecProvenanceEntry['source'],
      confidence: number,
      evidence?: string,
      rule?: string
    ): EventSpecProvenanceEntry {
      const bas = evidence ? description.indexOf(evidence) : -1;
      return {
        source,
        confidence,
        ...(evidence && bas >= 0
          ? { span: [bas, bas + evidence.length] as [number, number] }
          : {}),
        ...(rule ? { rule } : {}),
      };
    }

    /** Alani ve provenance girdisini birlikte yazar (ikisi hep ayni anda olusur). */
    function yaz<K extends keyof EventSpecV1>(
      alan: K,
      deger: NonNullable<EventSpecV1[K]>,
      kaynak: EventSpecProvenanceEntry
    ): void {
      spec[alan] = deger;
      provenance[alan] = kaynak;
    }

    /** "120" gibi duz sayi dizelerini cevirir; ayracli/ondalikli dizeyi REDDEDER. */
    function sayiya(v: unknown): number | null {
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      if (typeof v === 'string') {
        const t = v.replace(/\s/g, '');
        if (!/^\d+$/.test(t)) return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    }

    /** YYYY-MM-DD bicimi + gercek takvim gunu. */
    function gecerliGun(v: unknown): string | null {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
      const d = new Date(v + 'T00:00:00Z');
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v)
        return null;
      return v;
    }

    // event_type — yalniz aktif key listesinden
    const gecerliTurler = new Set(eventTypes.map((t) => t.key));
    const hamTur = hamAlan(parsed.event_type);
    if (
      hamTur &&
      typeof hamTur.value === 'string' &&
      gecerliTurler.has(hamTur.value)
    ) {
      yaz(
        'event_type',
        hamTur.value,
        girdi('extracted', hamTur.confidence, hamTur.evidence)
      );
    }

    // city_name -> city_id (Turkce duyarsiz esleme); eslesmezse extra.city_note
    const hamSehir = hamAlan(parsed.city_name);
    if (hamSehir && typeof hamSehir.value === 'string' && hamSehir.value.trim()) {
      const aranan = normalizeTr(hamSehir.value);
      const bulunan = cities.find((c) => normalizeTr(c.name) === aranan);
      if (bulunan) {
        yaz(
          'city_id',
          bulunan.id,
          girdi(
            'extracted',
            hamSehir.confidence,
            hamSehir.evidence,
            'city_name_match'
          )
        );
      } else {
        extra.city_note = hamSehir.value.trim();
      }
    }

    // district
    const hamIlce = hamAlan(parsed.district);
    if (hamIlce && typeof hamIlce.value === 'string') {
      const ilce = hamIlce.value.trim();
      if (ilce && ilce.length <= 100) {
        yaz(
          'district',
          ilce,
          girdi('extracted', hamIlce.confidence, hamIlce.evidence)
        );
      }
    }

    // start_date / end_date — gecmis tarih ve ters aralik yazilmaz
    const hamBas = hamAlan(parsed.start_date);
    let basTarih: string | null = null;
    if (hamBas) {
      const gun = gecerliGun(hamBas.value);
      if (gun && gun >= bugun) {
        basTarih = gun;
        yaz(
          'start_date',
          gun,
          girdi(
            hamBas.inferred ? 'derived' : 'extracted',
            hamBas.confidence,
            hamBas.evidence,
            hamBas.inferred ? 'date_assumed' : undefined
          )
        );
      }
    }
    const hamSon = hamAlan(parsed.end_date);
    if (hamSon) {
      const gun = gecerliGun(hamSon.value);
      if (gun && gun >= bugun && (!basTarih || gun >= basTarih)) {
        yaz(
          'end_date',
          gun,
          girdi(
            hamSon.inferred ? 'derived' : 'extracted',
            hamSon.confidence,
            hamSon.evidence,
            hamSon.inferred ? 'date_assumed' : undefined
          )
        );
      }
    }

    // date_note — spec alani DEGIL (extra'ya gider, provenance girdisi yok)
    if (typeof parsed.date_note === 'string') {
      const not = parsed.date_note.trim();
      if (not && not.length <= 100) extra.date_note = not;
    }

    // is_date_flexible
    const hamEsnek = hamAlan(parsed.is_date_flexible);
    if (hamEsnek && typeof hamEsnek.value === 'boolean') {
      yaz(
        'is_date_flexible',
        hamEsnek.value,
        girdi('extracted', hamEsnek.confidence, hamEsnek.evidence)
      );
    }

    // participant_count — tam sayi 1..100000
    const hamKisi = hamAlan(parsed.participant_count);
    if (hamKisi) {
      const sayi = sayiya(hamKisi.value);
      if (sayi !== null && Number.isInteger(sayi) && sayi >= 1 && sayi <= 100000) {
        yaz(
          'participant_count',
          sayi,
          girdi('extracted', hamKisi.confidence, hamKisi.evidence)
        );
      }
    }

    // budget_min / budget_max — negatif yazilmaz; ikisi de varsa ters aralik duzeltilir
    const hamMin = hamAlan(parsed.budget_min);
    const hamMax = hamAlan(parsed.budget_max);
    let butceMin = hamMin ? sayiya(hamMin.value) : null;
    let butceMax = hamMax ? sayiya(hamMax.value) : null;
    if (butceMin !== null && butceMin < 0) butceMin = null;
    if (butceMax !== null && butceMax < 0) butceMax = null;
    if (butceMin !== null && butceMax !== null && butceMin > butceMax) {
      const gecici = butceMin;
      butceMin = butceMax;
      butceMax = gecici;
    }
    if (hamMin && butceMin !== null) {
      yaz(
        'budget_min',
        butceMin,
        girdi('extracted', hamMin.confidence, hamMin.evidence)
      );
    }
    if (hamMax && butceMax !== null) {
      yaz(
        'budget_max',
        butceMax,
        girdi('extracted', hamMax.confidence, hamMax.evidence)
      );
    }

    // urgency — `normal` yazilmaz (varsayilan zaten o)
    const hamAcil = hamAlan(parsed.urgency);
    if (hamAcil && (hamAcil.value === 'urgent' || hamAcil.value === 'flexible')) {
      yaz(
        'urgency',
        hamAcil.value,
        girdi('extracted', hamAcil.confidence, hamAcil.evidence)
      );
    }

    // venue_status
    const hamMekan = hamAlan(parsed.venue_status);
    if (
      hamMekan &&
      (hamMekan.value === 'confirmed' ||
        hamMekan.value === 'searching' ||
        hamMekan.value === 'not_needed')
    ) {
      yaz(
        'venue_status',
        hamMekan.value,
        girdi('extracted', hamMekan.confidence, hamMekan.evidence)
      );
    }

    // title — model uretimi; arayuz "varsayim" isareti koyabilir
    if (typeof parsed.title === 'string') {
      const baslik = parsed.title.trim().slice(0, 200);
      if (baslik) {
        yaz('title', baslik, {
          source: 'derived',
          rule: 'model_title',
          confidence: 0.5,
        });
      }
    }

    // suggested_roles ve tip — bugunku mantik AYNEN (quantity/is_required P2'de)
    spec.suggested_roles = categories.map((c) => ({
      slug: c.slug,
      reason: c.reason,
    }));
    provenance.suggested_roles = { source: 'extracted' };
    if (tip) {
      spec.tip = tip;
      provenance.tip = { source: 'extracted' };
    }
    if (Object.keys(extra).length > 0) spec.extra = extra;

    // P1'de durum HER ZAMAN needs_input; `valid`'i kullanici onayiyla P2 yazar.
    const specVersionId = await specSurumuYaz(spec, provenance, 'needs_input');

    return {
      success: true,
      categories,
      tip,
      spec,
      provenance,
      ...(briefId ? { briefId } : {}),
      ...(specVersionId ? { specVersionId } : {}),
    };
  } catch (err) {
    console.error('[ai] analyzeEventNeeds error:', err);
    await hataSurumuYaz('Analiz sirasinda istisna');
    return {
      success: false,
      error: 'Analiz yapılırken bir sorun oluştu, tekrar dene.',
    };
  }
}

const MATCH_POOL_LIMIT = 12;
const BIO_SNIPPET_LEN = 240;

/**
 * Müşterinin niteliksel talebine göre profesyonel önerir.
 * MİMARİ: önce DB ön-filtre (kategori + opsiyonel şehir + is_published),
 * en fazla 12 aday çekilir, kısaltılmış profil verisi Claude'a verilir,
 * Claude SADECE bu havuzdan uygunlara göre sıralar + gerekçe yazar.
 * Maliyet: havuz küçük tutulur; aday yoksa Claude'a gidilmez.
 * Gizlilik: sadece yayındaki profiller, kısaltılmış veri (bio özeti + kategori).
 * Adillik: Claude'a premium öne çıkar denmez; saf uygunluk değerlendirir.
 */
export async function recommendProfessionals(input: {
  categorySlug: string;
  cityId: number | null;
  requirement: string;
}): Promise<ProMatchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  if (!anthropic) {
    return { success: false, error: 'AI servisi şu an kullanılamıyor.' };
  }

  const requirement = input.requirement.trim().slice(0, 800);
  if (requirement.length < 10) {
    return {
      success: false,
      error: 'Lütfen ne tür bir profesyonel aradığını biraz anlat.',
    };
  }

  // Kategori slug → id
  const { data: category } = await supabase
    .from('service_categories')
    .select('id, name_tr')
    .eq('slug', input.categorySlug)
    .eq('is_active', true)
    .single();

  if (!category) {
    return { success: false, error: 'Geçerli bir kategori seç.' };
  }

  // Ön-filtre: kategori + (opsiyonel) şehir + yayında + pro/ajans
  // FAZ 2c: aday havuzu saglayici gorunumunden; filtreler ve sutunlar ayni.
  let query = supabase
    .from('v_providers_public')
    .select('id, full_name, company_name, role, bio, premium_tier')
    .eq('is_published', true)
    .in('role', ['professional', 'agency'])
    .eq('primary_category_id', category.id)
    .limit(MATCH_POOL_LIMIT);

  if (input.cityId !== null) {
    query = query.eq('city_id', input.cityId);
  }

  const { data: pool } = await query;

  if (!pool || pool.length === 0) {
    return {
      success: false,
      error:
        'Bu kriterlere uygun yayında profesyonel bulunamadı. Şehir filtresini kaldırıp tekrar dene.',
    };
  }

  // Geçerli id kümesi — Claude sadece bunlardan dönebilsin
  const validIds = new Set(pool.map((p) => p.id));

  // Claude'a verilecek kısaltılmış profil listesi (gizlilik: bio özeti)
  const profileList = pool
    .map((p, i) => {
      const name =
        (p.role === 'agency' || p.role === 'business') && p.company_name
          ? p.company_name
          : p.full_name || 'İsimsiz';
      const bioSnippet = (p.bio || '')
        .trim()
        .slice(0, BIO_SNIPPET_LEN)
        .replace(/\s+/g, ' ');
      return `${i + 1}. id: ${p.id}
   İsim: ${name}
   Tür: ${p.role === 'agency' ? 'Ajans' : 'Bireysel profesyonel'}
   Hakkında: ${bioSnippet || '(bilgi yok)'}`;
    })
    .join('\n\n');

  const prompt = `Sen Kashe adlı etkinlik ve yetenek pazaryeri için bir eşleştirme asistanısın. Müşteri belirli bir ihtiyaç tarif ediyor, sen aşağıdaki aday profesyoneller arasından en uygun olanları seçiyorsun.

Müşterinin aradığı (${category.name_tr} kategorisinde):
"${requirement}"

Aday profesyoneller (SADECE bunlar arasından seç, başka kimse uydurma):

${profileList}

Görevin: Müşterinin tarifine en uygun profesyonelleri seç ve neden uygun olduklarını açıkla. Değerlendirmeni yalnızca müşterinin ihtiyacına uygunluğa göre yap. Yanıtını SADECE geçerli bir JSON dizisi olarak ver, başka hiçbir metin veya markdown ekleme. Yapı:

[
  { "id": "yukarıdaki listeden birebir id", "reason": "Bu profesyonelin neden uygun olduğunu açıklayan 1 kısa cümle" }
]

Kurallar:
- Türkçe yaz (id hariç — id yukarıdaki listeden birebir kopyalanmalı).
- En uygun 1-5 profesyonel seç (uygunluk sırasına göre, en uygun başta). Hiçbiri tam uymuyorsa en yakın olanları seç.
- "id" MUTLAKA yukarıdaki aday listesindeki id'lerden biri olmalı.
- "reason" somut ve müşterinin tarifiyle bağlantılı olsun.
- SADECE JSON dizisi döndür, başına/sonuna hiçbir şey ekleme, markdown kod bloğu (üç backtick) kullanma.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    let raw =
      textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

    if (!raw) {
      return { success: false, error: 'Öneri üretilemedi, tekrar dene.' };
    }

    raw = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed: { id?: string; reason?: string }[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { success: false, error: 'Öneri sonucu okunamadı, tekrar dene.' };
    }

    if (!Array.isArray(parsed)) {
      return { success: false, error: 'Öneri sonucu beklenmedik biçimde.' };
    }

    // Sadece geçerli (havuzdaki) id'leri al, profil bilgisini DB'den eşle
    const matches: ProMatch[] = parsed
      .filter(
        (m): m is { id: string; reason?: string } =>
          typeof m?.id === 'string' && validIds.has(m.id)
      )
      .map((m) => {
        const p = pool.find((pp) => pp.id === m.id)!;
        const name =
          (p.role === 'agency' || p.role === 'business') && p.company_name
            ? p.company_name
            : p.full_name || 'İsimsiz';
        return {
          id: m.id,
          name,
          reason: (m.reason || '').trim(),
        };
      });

    if (matches.length === 0) {
      return {
        success: false,
        error:
          'Tarifine tam uyan bir profesyonel seçilemedi. Aramanı biraz değiştirip tekrar dene.',
      };
    }

    return { success: true, matches };
  } catch (err) {
    console.error('[ai] recommendProfessionals error:', err);
    return {
      success: false,
      error: 'Öneri yapılırken bir sorun oluştu, tekrar dene.',
    };
  }
}