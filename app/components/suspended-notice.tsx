import { TopNav } from '@/app/components/sections/top-nav';

/**
 * Askıya alınmış kullanıcıya gösterilen ortak bildirim.
 *
 * NOT: Korunan sayfalarda `redirect('/askiya-alindi')` YERİNE bu bileşen
 * render edilir. Sebep: client-side navigation sırasında server component
 * içinden redirect() Next.js router'ını bozuyor ("rendered more hooks"
 * hatası). Sayfa-içi return ile bu sorun yaşanmaz + kullanıcı net mesaj görür.
 */
export function SuspendedNotice() {
  return (
    <>
      <TopNav />
      <div className="bg-paper min-h-screen">
        <div className="max-w-2xl mx-auto px-6 md:px-12 py-20 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-4">
            Hesap askıda
          </p>
          <h1 className="font-display text-4xl text-ink mb-3">
            Hesabın şu an{' '}
            <em className="text-terracotta not-italic italic font-medium">
              askıya alınmış
            </em>
          </h1>
          <p className="text-ink-72 mb-8">
            Bu durumda profilini, mesajlarını, ilanlarını ve diğer işlemlerini
            yönetemezsin. Hesabın geri açıldığında bildirim alacaksın.
            Sorularınız için destek ekibiyle iletişime geçebilirsin.
          </p>
          <a
            href="mailto:kasheofficial@gmail.com?subject=Hesap%20Askısı%20İtirazı"
            className="inline-block px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
          >
            Destek ekibine yaz →
          </a>
        </div>
      </div>
    </>
  );
}
