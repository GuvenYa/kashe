'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { EmptyState } from '@/app/components/EmptyState';
import { Send } from 'lucide-react';
import { BasvuruSatiri } from './basvuru-satiri';
import type {
  ApplicationWithRelations,
  ApplicationStatus,
} from '../ilanlar/listings-data';

type Props = {
  applications: ApplicationWithRelations[];
  activeStatus: string | null;
};

const STATUS_TABS: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'shortlisted', label: 'Kısa listede' },
  { key: 'accepted', label: 'Kabul' },
  { key: 'rejected', label: 'Reddedildi' },
  { key: 'withdrawn', label: 'Geri çekildi' },
];

export function BasvurularimListesi({ applications, activeStatus }: Props) {
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
      router.push(qs ? `/basvurularim?${qs}` : '/basvurularim');
    });
  }

  const filtered =
    activeStatus && activeStatus !== 'all'
      ? applications.filter((a) => a.status === activeStatus)
      : applications;

  const counts: Record<string, number> = { all: applications.length };
  applications.forEach((a) => {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
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
                    ? 'bg-brand-ink text-paper'
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={Send}
          title={
            applications.length === 0
              ? 'Henüz başvuru yapmadın'
              : 'Bu durumda başvuru yok'
          }
          description={
            applications.length === 0
              ? 'İlan tahtasından sana uygun ilanları bul, başvurularını buradan takip et.'
              : 'Farklı bir durum seç veya tüm başvurularını gör.'
          }
          action={
            applications.length === 0
              ? { label: 'İlanları gör', href: '/ilanlar' }
              : { label: 'Tüm başvuruları gör', href: '/basvurularim' }
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <BasvuruSatiri key={app.id} application={app} />
          ))}
        </div>
      )}
    </div>
  );
}