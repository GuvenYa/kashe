'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { inviteProfessional } from '@/app/ajans/agency-actions';
import {
  ORG_ROLES,
  ORG_ROLE_LABELS,
  ORG_ROLE_SUMMARIES,
  type OrgRole,
} from '@/app/lib/org-roles';

/** Davetle verilebilen roller: sahip HARIC (RPC de reddeder). */
const DAVET_ROLLERI = ORG_ROLES.filter((r) => r !== 'owner');

type Props = {
  onClose: () => void;
};

export function UyeDavetFormu({ onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [email, setEmail] = useState('');
  const [memberRole, setMemberRole] = useState<OrgRole>('viewer');
  const [message, setMessage] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email girmelisin');
      return;
    }

    startTransition(async () => {
      const result = await inviteProfessional({
        email: trimmedEmail,
        role: memberRole,
        message: message.trim() || null,
      });

      if (result.success) {
        setSuccess(true);
        // 1.5 saniye sonra formu sıfırla + kapat
        setTimeout(() => {
          setSuccess(false);
          setEmail('');
          setMessage('');
          setMemberRole('viewer');
          router.refresh();
        }, 1500);
      } else {
        setError(result.error);
      }
    });
  }

  if (success) {
    return (
      <div className="bg-ink-blue/5 border-2 border-ink-blue/15 rounded-lg p-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-blue mb-2">
          ✓ Davet gönderildi
        </p>
        <p className="text-sm text-ink">
          {email} adresine davet ulaştırıldı. Profesyonel Kashe&apos;de kayıtlıysa
          bildirim alır, değilse email ile davet edilir.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-line rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="font-display text-lg text-ink">Yeni üye davet et</p>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-72 hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center"
          aria-label="İptal"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Profesyonelin emaili
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="profesyonel@email.com"
            required
            className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
          />
          <p className="text-[10px] text-ink-72 mt-1 font-mono">
            Kashe&apos;ye kayıtlı değilse, davetiye email ile gönderilir.
          </p>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Kuruluş rolü
          </label>
          <div className="flex flex-wrap gap-2">
            {DAVET_ROLLERI.map((rol) => (
              <button
                key={rol}
                type="button"
                onClick={() => setMemberRole(rol)}
                title={ORG_ROLE_SUMMARIES[rol]}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                  memberRole === rol
                    ? 'bg-brand-ink text-paper border-brand-ink'
                    : 'bg-paper text-ink-72 border-line hover:border-brand-ink/50'
                }`}
              >
                {ORG_ROLE_LABELS[rol]}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-ink-72 mt-1 font-mono">
            {ORG_ROLE_SUMMARIES[memberRole]}
          </p>
          <p className="text-[10px] text-ink-72 mt-1 font-mono">
            Katıldıktan sonra rolü üye kartından değiştirebilirsin.
          </p>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Davet mesajı <span className="lowercase">(opsiyonel)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Davet edilen kişiye kişisel bir not bırak..."
            rows={3}
            maxLength={1000}
            className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none"
          />
          <p className="text-[10px] text-ink-72 mt-1 font-mono">
            {message.length} / 1000 karakter
          </p>
        </div>

        {error && (
          <div className="bg-danger-08 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-5 py-3 border border-line text-ink-72 rounded-lg font-display font-semibold text-sm hover:bg-paper transition"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send size={14} strokeWidth={1.75} />
            {isPending ? 'Gönderiliyor...' : 'Daveti gönder'}
          </button>
        </div>
      </form>
    </div>
  );
}