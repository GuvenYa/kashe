'use server';

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/app/lib/supabase-server';

type AIResult =
  | { success: true; text: string }
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