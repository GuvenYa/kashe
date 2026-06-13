import Link from 'next/link';
import { formatLastSeen, getLastSeenTone } from '@/app/lib/profile-helpers';

type OtherUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
  bio: string | null;
  phone: string | null;
  city: string | null;
  last_seen_at: string | null;
};

type Props = {
  other: OtherUser;
  viewerRole: 'customer' | 'professional';
  // İletişim gate (komisyon-kritik): true ise telefon görünür.
  // false ise other.phone zaten null gelir (data katmanı) — burada sadece
  // "neden gizli" notunu çiziyoruz.
  contactUnlocked: boolean;
};

export function KarsiTarafPaneli({ other, viewerRole, contactUnlocked }: Props) {
  const isOtherProfessional = other.role === 'professional' || other.role === 'business';

  const displayName =
    other.role === 'business' && other.company_name
      ? other.company_name
      : other.full_name || 'İsimsiz';

  const initials = (displayName || 'K')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const roleLabel =
    other.role === 'professional'
      ? 'Profesyonel'
      : other.role === 'business'
        ? 'Kurumsal'
        : 'Müşteri';

  // Profesyonele tıklanınca kamu profiline gidebilir; müşterinin kamu profili yok
  const showProfileLink = isOtherProfessional;

  return (
    <aside className="bg-white border border-line rounded-lg p-6 md:sticky md:top-24 md:self-start">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-4">
        Konuşulan kişi
      </p>

      {/* Avatar + Ad */}
      <div className="flex flex-col items-center text-center mb-5">
        {other.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={other.avatar_url}
            alt={displayName}
            className="w-20 h-20 rounded-full object-cover border-2 border-line mb-3"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-2xl mb-3">
            {initials}
          </div>
        )}
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1">
          {roleLabel}
        </p>
        <p className="font-display text-lg text-ink leading-tight">
          {displayName}
        </p>
        {(() => {
          const lastSeenText = formatLastSeen(other.last_seen_at);
          const tone = getLastSeenTone(other.last_seen_at);
          if (!lastSeenText) return null;

          const dotColor =
            tone === 'active'
              ? 'bg-green-500'
              : tone === 'recent'
                ? 'bg-amber-500'
                : 'bg-ink-72/40';

          return (
            <p className="text-xs text-ink-72 mt-2 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${dotColor}`}
                aria-hidden="true"
              />
              {lastSeenText}
            </p>
          );
        })()}
      </div>

      {/* Şehir + Telefon (gate'li) */}
      {(other.city || other.phone || !contactUnlocked) && (
        <div className="space-y-3 pt-4 border-t border-line">
          {other.city && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-0.5">
                Şehir
              </p>
              <p className="text-sm text-ink">{other.city}</p>
            </div>
          )}

          {/* Telefon: anlaşma onaylanınca açılır. Kilitliyken numara client'a
              hiç gelmez (other.phone === null); burada sadece sebebi gösteriyoruz. */}
          {contactUnlocked ? (
            other.phone && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-0.5">
                  Telefon
                </p>
                <a
                  href={`tel:${other.phone}`}
                  className="text-sm text-ink hover:text-terracotta transition-colors"
                >
                  {other.phone}
                </a>
              </div>
            )
          ) : (
            <div className="rounded-md bg-paper border border-line px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-1 flex items-center gap-1.5">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                İletişim kilitli
              </p>
              <p className="text-xs text-ink-72 leading-relaxed">
                Telefon numarası, rezervasyon onaylandıktan sonra görünür.
                Anlaşana kadar mesajlaşma Kashe üzerinden devam eder.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bio (varsa) */}
      {other.bio && (
        <div className="pt-4 border-t border-line mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-1.5">
            Hakkında
          </p>
          <p className="text-sm text-ink-72 leading-relaxed whitespace-pre-wrap line-clamp-6">
            {other.bio}
          </p>
        </div>
      )}

      {/* Profil link (sadece profesyonel/kurumsal için) */}
      {showProfileLink && (
        <Link
          href={`/p/${other.id}`}
          className="block mt-5 px-4 py-2.5 border border-ink text-ink rounded-lg font-display font-medium text-center text-sm hover:bg-ink hover:text-paper transition-colors"
        >
          Profilini gör
        </Link>
      )}
    </aside>
  );
}