'use server';

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/app/lib/supabase-server';

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
      budgetEstimate: string;
      tip: string;
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
- Profesyonellerin başvurmak isteyeceği, net ve davetkâr bir dil kullan.
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
 * olduğunu + tahmini bütçe + ipucu önerir. Claude'a SADECE gerçek kategori
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

  // Geçerli kategori listesi — Claude sadece bunlardan seçecek
  const validSlugs = new Set(input.categories.map((c) => c.slug));
  const categoryList = input.categories
    .map((c) => `- ${c.name_tr} (slug: ${c.slug})`)
    .join('\n');

  const prompt = `Sen Kashe adlı etkinlik ve yetenek pazaryeri için bir etkinlik planlama asistanısın. Müşteriler etkinliklerini anlatıyor, sen onlara hangi profesyonellere/hizmetlere ihtiyaçları olduğunu öneriyorsun.

Müşterinin etkinlik açıklaması:
"${description}"

Kashe'de SADECE şu hizmet kategorileri var. Önerilerini KESİNLİKLE bu listeden seç, listede olmayan bir kategori UYDURMA:
${categoryList}

Görevin: Bu etkinlik için en uygun hizmet kategorilerini öner. Yanıtını SADECE geçerli bir JSON nesnesi olarak ver, başka hiçbir metin, açıklama veya markdown ekleme. JSON yapısı:

{
  "categories": [
    { "slug": "kategori-slug", "name": "Kategori Adı", "reason": "Bu etkinlik için neden gerekli olduğunu açıklayan 1 kısa cümle" }
  ],
  "budgetEstimate": "Türkiye için gerçekçi tahmini toplam bütçe aralığı, örn: '40.000 - 70.000 TL'",
  "tip": "Müşteriye etkinliğiyle ilgili 1-2 cümlelik faydalı bir ipucu"
}

Kurallar:
- Türkçe yaz (slug hariç — slug yukarıdaki listedeki gibi kalsın).
- "categories" içinde 2-5 öneri olsun, en alakalı olanlar. Her slug yukarıdaki listeden BİREBİR olmalı.
- "reason" kısa ve somut olsun.
- "budgetEstimate" gerçekçi olsun, etkinliğin ölçeğine göre. Bilgi azsa makul bir aralık ver.
- "tip" samimi ve işe yarar olsun.
- SADECE JSON döndür, başına/sonuna hiçbir şey ekleme, markdown kod bloğu (üç backtick) kullanma.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    let raw =
      textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

    if (!raw) {
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
      budgetEstimate?: string;
      tip?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
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
      return {
        success: false,
        error:
          'Etkinliğin için uygun bir öneri bulunamadı. Biraz daha detay ekleyip tekrar dene.',
      };
    }

    return {
      success: true,
      categories,
      budgetEstimate: (parsed.budgetEstimate || '').trim(),
      tip: (parsed.tip || '').trim(),
    };
  } catch (err) {
    console.error('[ai] analyzeEventNeeds error:', err);
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
  let query = supabase
    .from('profiles')
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