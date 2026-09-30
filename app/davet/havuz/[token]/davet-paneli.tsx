'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  claimTalentInvitation,
  declineTalentInvitation,
} from '@/app/lib/havuz-claim-actions';

const BTN_BIRINCIL =
  'kashe-tap px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-5 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';

/** Oturumlu ve rolu uygun kullanici: sahiplen / reddet. Karari DB verir. */
export function DavetPaneli({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<'claimed' | 'declined' | null>(null);

  function sahiplen() {
    setHata(null);
    startTransition(async () => {
      const res = await claimTalentInvitation(token);
      if (res.success) {
        setSonuc('claimed');
        return;
      }
      if (res.needsLogin) {
        router.push(
          `/giris?redirect=${encodeURIComponent(`/davet/havuz/${token}`)}`
        );
        return;
      }
      setHata(res.error);
    });
  }

  function reddet() {
    setHata(null);
    startTransition(async () => {
      const res = await declineTalentInvitation(token);
      if (res.success) {
        setSonuc('declined');
        return;
      }
      if (res.needsLogin) {
        router.push(
          `/giris?redirect=${encodeURIComponent(`/davet/havuz/${token}`)}`
        );
        return;
      }
      setHata(res.error);
    });
  }

  if (sonuc === 'claimed') {
    return (
      <div className="mt-6 space-y-5">
        <p className="px-4 py-3 bg-brand-ink-08 border border-brand-ink/25 rounded-lg text-ink leading-relaxed">
          Kayıt profiline bağlandı. Kuruluş artık seni havuzunda Kashe üyesi
          olarak görüyor.
        </p>
        <Link href="/profil" className={BTN_BIRINCIL}>
          Profilime git
        </Link>
      </div>
    );
  }

  if (sonuc === 'declined') {
    return (
      <div className="mt-6 space-y-5">
        <p className="px-4 py-3 bg-card border border-line rounded-lg text-ink-72 leading-relaxed">
          Daveti reddettin. Kuruluş isterse yeni bir davet gönderebilir.
        </p>
        <Link href="/profil" className={BTN_IKINCIL}>
          Profile dön
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <p className="text-ink-72 leading-relaxed">
        Kaydı sahiplenirsen kuruluşun havuzunda Kashe üyesi olarak görünürsün;
        rollerini ve iletişim bilgilerini kuruluş yönetmeye devam eder. Daveti
        reddedersen kayıt kuruluşta harici kişi olarak kalır.
      </p>

      {hata && (
        <p className="px-4 py-3 bg-danger/8 border border-danger/25 rounded-lg text-sm text-danger">
          {hata}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={sahiplen}
          disabled={isPending}
          className={BTN_BIRINCIL}
        >
          {isPending ? 'İşleniyor…' : 'Kaydı sahiplen'}
        </button>
        <button
          type="button"
          onClick={reddet}
          disabled={isPending}
          className={BTN_IKINCIL}
        >
          Reddet
        </button>
      </div>
    </div>
  );
}
