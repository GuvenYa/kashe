'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { EmptyState } from '@/app/components/EmptyState';
import { Briefcase } from 'lucide-react';
import { IlanSatiri } from './ilan-satiri';
import type {
  ListingWithRelations,
  ListingStatus,
} from '../ilanlar/listings-data';

type ListingItem = ListingWithRelations & {
  application_count: number;
  is_own: boolean;
  can_manage: boolean;
  owner_business_name: string | null;
};

type Props = {
  listings: ListingItem[];
  activeStatus: string | null;
};

const STATUS_TABS: { key: ListingStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending_approval', label: 'Onay Bekleyen' },
  { key: 'revision', label: 'Revizyonda' },
  { key: 'rejected', label: 'Reddedilen' },
  { key: 'published', label: 'Yayında' },
  { key: 'draft', label: 'Taslak' },
  { key: 'closed', label: 'Kapatılan' },
  { key: 'filled', label: 'Dolduruldu' },
  { key: 'cancelled', label: 'İptal' },
];

export function IlanlarimListesi({ listings, activeStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setStatus(key: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === null || key === 'all') {
      params.delete('durum');
    } else {
      params.set('durum', key);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/ilanlarim?${qs}` : '/ilanlarim');
    });
  }

  // Kendi ilanları (tam aksiyon) vs kurum ilanları (read-only)
  const ownListings = listings.filter((l) => l.is_own);
  const teamListings = listings.filter((l) => !l.is_own);

  // Status filtresi + sayıları SADECE kendi ilanlarından (kurum ilanları tab'lara karışmaz)
  const filtered =
    activeStatus && activeStatus !== 'all'
      ? ownListings.filter((l) => l.status === activeStatus)
      : ownListings;

  const counts: Record<string, number> = { all: ownListings.length };
  ownListings.forEach((l) => {
    counts[l.status] = (counts[l.status] ?? 0) + 1;
  });

  const currentKey = activeStatus ?? 'all';

  // Kurum ilanlarını kurum adına göre grupla
  const teamGroups: { name: string; items: ListingItem[] }[] = [];
  const teamGroupIndex: Record<string, number> = {};
  teamListings.forEach((l) => {
    const name = l.owner_business_name ?? 'Kurum';
    if (teamGroupIndex[name] === undefined) {
      teamGroupIndex[name] = teamGroups.length;
      teamGroups.push({ name, items: [] });
    }
    teamGroups[teamGroupIndex[name]].items.push(l);
  });

  // Kendi ilan bölümü: kendi ilanı varsa ya da hiç kurum ilanı yoksa (sahip/normal
  // client davranışı bire bir korunur). Sadece kurum üyesi (kendi ilanı yok) → gizlenir.
  const showOwnSection = ownListings.length > 0 || teamListings.length === 0;

  return (
    <div>
      {showOwnSection && (
        <>
          {/* Status tabs */}
          <div className="bg-card border border-line rounded-lg p-2 mb-6 overflow-x-auto">
            <div className="flex gap-1 min-w-min">
              {STATUS_TABS.map((tab) => {
                const count = counts[tab.key] ?? 0;
                const isActive = currentKey === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatus(tab.key === 'all' ? null : tab.key)}
                    disabled={isPending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-[0.1em] transition whitespace-nowrap ${
                      isActive
                        ? 'bg-terracotta text-paper'
                        : 'text-ink-72 hover:text-ink hover:bg-paper'
                    } disabled:opacity-50`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-paper/20 text-paper'
                            : 'bg-ink-72/10 text-ink-72'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kendi ilanları */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title={
                ownListings.length === 0
                  ? 'Henüz ilan açmadın'
                  : 'Bu durumda ilan yok'
              }
              description={
                ownListings.length === 0
                  ? 'İlk ilanını aç, profesyoneller başvursun.'
                  : 'Farklı bir durum seç veya tüm ilanlarını gör.'
              }
              action={
                ownListings.length === 0
                  ? { label: 'Yeni ilan aç', href: '/ilanlar/yeni' }
                  : { label: 'Tüm ilanları gör', href: '/ilanlarim' }
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((listing) => (
                <IlanSatiri key={listing.id} listing={listing} isOwn />
              ))}
            </div>
          )}
        </>
      )}

      {/* Kurum ilanları — üyesi olunan kurumlar adına (manager+ → edit/publish; member → salt) */}
      {teamGroups.map((group) => (
        <section key={group.name} className={showOwnSection ? 'mt-12' : ''}>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
            Kurum: {group.name} adına
          </p>
          <div className="space-y-3">
            {group.items.map((listing) => (
              <IlanSatiri
                key={listing.id}
                listing={listing}
                isOwn={false}
                canManage={listing.can_manage}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
