'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { EmptyState } from '@/app/components/EmptyState';
import { Briefcase } from 'lucide-react';
import { IlanSatiri } from './ilan-satiri';
import type {
  ListingWithRelations,
  ListingStatus,
} from '../ilanlar/listings-data';

type Props = {
  listings: (ListingWithRelations & { application_count: number })[];
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

  // Status filtresi uygula
  const filtered =
    activeStatus && activeStatus !== 'all'
      ? listings.filter((l) => l.status === activeStatus)
      : listings;

  // Status sayıları (filtre olsa da olmasa da toplam datadan hesapla)
  const counts: Record<string, number> = { all: listings.length };
  listings.forEach((l) => {
    counts[l.status] = (counts[l.status] ?? 0) + 1;
  });

  const currentKey = activeStatus ?? 'all';

  return (
    <div>
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

      {/* Liste */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={
            listings.length === 0
              ? 'Henüz ilan açmadın'
              : 'Bu durumda ilan yok'
          }
          description={
            listings.length === 0
              ? 'İlk ilanını aç, profesyoneller başvursun.'
              : 'Farklı bir durum seç veya tüm ilanlarını gör.'
          }
          action={
            listings.length === 0
              ? { label: 'Yeni ilan aç', href: '/ilanlar/yeni' }
              : { label: 'Tüm ilanları gör', href: '/ilanlarim' }
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((listing) => (
            <IlanSatiri key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}