import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  /** Lucide ikon component (örn. Heart, Bell). İleride özgün ikonlarla değiştirilecek. */
  icon: LucideIcon;
  /** Başlık — büyük metin */
  title: string;
  /** Açıklama — daha küçük destek metni */
  description?: string;
  /** Aksiyon butonu (opsiyonel) */
  action?: {
    label: string;
    href: string;
  };
};

/**
 * Sayfa içeriği boş olduğunda kullanılan standart blok.
 *
 * Geçici olarak Lucide ikon kullanıyoruz. İleride bu component'te ikon yerine
 * Kashe'ye özgün custom illüstrasyonlar gelecek — sadece bu dosyayı değiştireceğiz,
 * onu kullanan 4+ sayfaya dokunmayacağız.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white border border-line rounded-lg p-12 text-center">
      <div
        className="w-16 h-16 mx-auto mb-5 rounded-full bg-terracotta/8 flex items-center justify-center"
        aria-hidden="true"
      >
        <Icon className="w-7 h-7 text-terracotta/60" strokeWidth={1.5} />
      </div>

      <p className="font-display text-xl text-ink mb-3">{title}</p>

      {description && (
        <p className="text-ink-72 max-w-md mx-auto mb-6">{description}</p>
      )}

      {action && (
        <a
          href={action.href}
          className="inline-block px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}