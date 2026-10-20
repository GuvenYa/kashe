import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { PanelKabugu } from '@/app/components/panel';
import type { PanelMenuGrubu } from '@/app/lib/panel-menu-tipler';

export const metadata = {
  title: 'Admin — Kashe',
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin layout — erişim koruması burada yapılır.
 * /admin/* altındaki tüm sayfalar bu layout'tan geçer.
 *
 * Sadece is_admin=true olan kullanıcılar erişebilir.
 * Diğerleri /'a yönlendirilir (404 yerine sessiz yönlendirme —
 * admin sayfasının varlığını dışarıya sızdırmamak için).
 *
 * D1a: yerlesim artik ortak `PanelKabugu` (eski `AdminNav` bu kabuga dondu).
 * Menu SABIT: admin yuzeyinde rol/izin dallanmasi yok, maddeler ve siralari
 * aynen korundu — degisen yalniz kabuk.
 */
const ADMIN_MENU: PanelMenuGrubu[] = [
  {
    baslik: 'Yönetim',
    maddeler: [
      { href: '/admin', etiket: 'Dashboard', ikon: 'gosterge' },
      { href: '/admin/profiller', etiket: 'Profiller', ikon: 'profil' },
      { href: '/admin/ilanlar', etiket: 'İlanlar', ikon: 'ilan' },
      { href: '/admin/kullanicilar', etiket: 'Kullanıcılar', ikon: 'havuz' },
      {
        href: '/admin/kategori-talepleri',
        etiket: 'Kategori Talepleri',
        ikon: 'kategori',
      },
    ],
  },
  {
    baslik: 'Denetim',
    maddeler: [
      { href: '/admin/yorumlar', etiket: 'Yorumlar', ikon: 'mesaj' },
      { href: '/admin/sikayetler', etiket: 'Şikayetler', ikon: 'sikayet' },
      { href: '/admin/istatistikler', etiket: 'İstatistikler', ikon: 'istatistik' },
    ],
  },
  {
    baslik: 'İçerik',
    maddeler: [
      { href: '/admin/blog', etiket: 'Blog', ikon: 'blog' },
      { href: '/admin/gorusler', etiket: 'Görüşler', ikon: 'gorus' },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, full_name, avatar_url')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect('/');
  }

  const adminName = profile.full_name || user.email || 'Admin';

  return (
    <PanelKabugu
      menu={ADMIN_MENU}
      hesap={{
        ad: adminName,
        altSatir: 'Platform yöneticisi',
        avatarUrl: profile.avatar_url ?? null,
        rozet: 'Admin',
      }}
    >
      {children}
    </PanelKabugu>
  );
}
