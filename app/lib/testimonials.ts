import { createClient } from '@/app/lib/supabase-server';

export type Testimonial = {
  id: string;
  author_name: string;
  author_role: string | null;
  body: string;
  rating: number;
  is_published: boolean;
  sort_order: number;
  source_note: string | null;
  created_at: string;
};

// Kamuya açık görünüm — iç not (source_note) HARİÇ. Public yol bu alanı istemez.
export type PublicTestimonial = Omit<Testimonial, 'source_note'>;

// Public sorgu: source_note yok (iç not kamuya sızmasın). Admin sorgu: tüm alanlar.
const PUBLIC_COLS =
  'id, author_name, author_role, body, rating, is_published, sort_order, created_at';
const ADMIN_COLS = `${PUBLIC_COLS}, source_note`;

/**
 * Ana sayfa "Kullanıcılar ne diyor?" bölümü için yayındaki görüşler.
 * sort_order artan, varsayılan limit 3. RLS yalnız is_published=true döndürür.
 * NOT: source_note (iç not) public yolda hiç çekilmez.
 */
export async function getPublishedTestimonials(
  limit = 3
): Promise<PublicTestimonial[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('testimonials')
    .select(PUBLIC_COLS)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as PublicTestimonial[];
}

/**
 * ADMIN: tüm görüşler (taslak + source_note dahil). RLS admin dalı hepsini döndürür.
 * Liste sayfası için — sort_order sonra en yeni.
 */
export async function getAllTestimonials(): Promise<Testimonial[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('testimonials')
    .select(ADMIN_COLS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return (data ?? []) as Testimonial[];
}
