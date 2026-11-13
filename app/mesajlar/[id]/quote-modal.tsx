'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  QUOTE_EXPIRY_OPTIONS,
  CANCELLATION_POLICY_TEMPLATES,
  type QuoteExpiryKey,
} from '../quotes-data';
import { createQuote } from '../quote-actions';
import { getQuoteTemplates } from '@/app/lib/message-templates';
import { istanbulGunu } from '@/app/lib/tarih';
import { TarihSecici } from '@/app/components/ui/tarih-secici';
import { SaatSecici } from '@/app/components/ui/saat-secici';
import { KonumAlani } from '@/app/components/ui/konum-alani';
import type { Il } from '@/app/components/ui/il-secici';

const KUCUK_ALAN =
  'w-full px-3 py-2.5 bg-card border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';
const KUCUK_KUTU =
  'flex-1 min-w-0 px-2.5 py-2.5 bg-card border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

/**
 * Duzeltme 12-A (bulgu 115): teklif kendi tarihini, saatini ve yerini tasir.
 * Alanlar sohbetteki musteri secimiyle DOLU gelir; musteri belirtmediyse
 * profesyonel secer ya da bos birakir (rezervasyon sohbetinkini alir).
 */
export type TeklifVarsayilanlari = {
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
};

type Props = {
  conversationId: string;
  categorySlug: string | null;
  open: boolean;
  onClose: () => void;
  varsayilan: TeklifVarsayilanlari;
  /** Duzeltme 18-B: 81 il - "Yer" il + ilce + mekan secicisi (bossa serbest metin). */
  iller: Il[];
};

/** Sohbetteki tarih gecmisse formu doldurmaz (veritabani da reddeder). */
function gelecekTarih(gun: string | null): string {
  if (!gun) return '';
  const g = gun.slice(0, 10);
  return g >= istanbulGunu() ? g : '';
}

export function QuoteModal({
  conversationId,
  categorySlug,
  open,
  onClose,
  varsayilan,
  iller,
}: Props) {
  const quoteTemplates = getQuoteTemplates(categorySlug);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expiryKey, setExpiryKey] = useState<QuoteExpiryKey>('7d');
  const [policyKey, setPolicyKey] = useState<string>('standard');
  const [customPolicy, setCustomPolicy] = useState('');
  const [useCustomPolicy, setUseCustomPolicy] = useState(false);
  // Tarih / saat / yer — sohbetteki musteri seciminden (bkz. TeklifVarsayilanlari)
  const musteriTarihi = gelecekTarih(varsayilan.eventDate);
  const [eventDate, setEventDate] = useState(musteriTarihi);
  const [startTime, setStartTime] = useState(varsayilan.startTime?.slice(0, 5) ?? '');
  const [endTime, setEndTime] = useState(varsayilan.endTime?.slice(0, 5) ?? '');
  const [location, setLocation] = useState(varsayilan.location ?? '');

  if (!open) return null;

  function resetForm() {
    setAmount('');
    setDescription('');
    setExpiryKey('7d');
    setPolicyKey('standard');
    setCustomPolicy('');
    setUseCustomPolicy(false);
    setEventDate(musteriTarihi);
    setStartTime(varsayilan.startTime?.slice(0, 5) ?? '');
    setEndTime(varsayilan.endTime?.slice(0, 5) ?? '');
    setLocation(varsayilan.location ?? '');
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Geçerli bir fiyat gir');
      return;
    }
    if (description.trim().length < 10) {
      setError('Hizmet açıklaması en az 10 karakter olmalı');
      return;
    }
    if (endTime && !startTime) {
      setError('Bitiş saati için başlangıç saati de gir');
      return;
    }

    const policyText = useCustomPolicy
      ? customPolicy.trim()
      : CANCELLATION_POLICY_TEMPLATES.find((p) => p.key === policyKey)?.text ?? null;

    startTransition(async () => {
      const result = await createQuote({
        conversationId,
        totalAmount: amountNum,
        servicesDescription: description.trim(),
        cancellationPolicy: policyText || null,
        expiryKey,
        eventDate: eventDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        location: location.trim() || null,
      });

      if (result.success) {
        resetForm();
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-paper rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-line p-5 sticky top-0 bg-paper z-10 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-1">
              Yeni teklif
            </p>
            <h2 className="font-display text-2xl text-ink">
              <em className="not-italic font-medium text-brand-accent">
                Teklif
              </em>{' '}
              gönder
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-ink-72 hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Fiyat */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Toplam fiyat (TL)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5.000"
                className="w-full px-4 py-3 pr-12 bg-card border border-line rounded-lg text-ink text-lg font-medium focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-72 text-sm font-mono">
                TL
              </span>
            </div>
          </div>

          {/* Tarih / saat / yer (Duzeltme 12-A) */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-1">
              Tarih, saat ve yer
            </p>
            <p className="text-[11px] text-ink-50 mb-2.5 leading-relaxed">
              {musteriTarihi
                ? 'Müşterinin seçtiği tarihle dolu geldi; gerekirse değiştir.'
                : 'Müşteri tarih belirtmedi. Sen seçebilir ya da boş bırakabilirsin; boş kalırsa rezervasyon "Tarih belirlenmedi" olur.'}
            </p>
            {/* Duzeltme 14-A: Turkce tarih secici ve 24 saatlik saat kutulari
                (tarayicinin dili "ay / gun / yil" ya da AM / PM gostermesin). */}
            <div className="space-y-2.5">
              <div>
                <label htmlFor="teklif-tarih" className="text-[11px] text-ink-72 block mb-1">
                  Tarih
                </label>
                <TarihSecici
                  id="teklif-tarih"
                  deger={eventDate}
                  onDegis={setEventDate}
                  temizlenebilir
                  className={KUCUK_ALAN}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label htmlFor="teklif-baslangic" className="text-[11px] text-ink-72 block mb-1">
                    Başlangıç
                  </label>
                  <SaatSecici
                    id="teklif-baslangic"
                    deger={startTime}
                    onDegis={setStartTime}
                    etiket="Başlangıç"
                    kutuSinifi={KUCUK_KUTU}
                  />
                </div>
                <div>
                  <label htmlFor="teklif-bitis" className="text-[11px] text-ink-72 block mb-1">
                    Bitiş
                  </label>
                  <SaatSecici
                    id="teklif-bitis"
                    deger={endTime}
                    onDegis={setEndTime}
                    etiket="Bitiş"
                    kutuSinifi={KUCUK_KUTU}
                  />
                </div>
              </div>
            </div>
            {/* Duzeltme 18-B: il listeden, buyuksehirde ilce de listeden; deger
                musteri formlariyla ayni bicimde ("<mekan>, <ilce>, <Il>").
                Form her aciliste yeniden kuruldugu icin (ust bilesendeki
                `key`) kutular sohbetteki guncel konumla dolar. */}
            <div className="mt-2">
              <label
                htmlFor="teklif-yer"
                className="text-[11px] text-ink-72 block mb-1"
              >
                Yer
              </label>
              <KonumAlani
                id="teklif-yer"
                iller={iller}
                deger={location}
                onChange={setLocation}
                kutuSinifi={KUCUK_ALAN}
              />
            </div>
          </div>

          {/* Hizmet açıklaması */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Hizmet kapsamı
            </label>
            {quoteTemplates.length > 0 && (
              <div className="mb-2.5 rounded-lg border border-brand-ink/20 bg-brand-ink/[0.05] p-2.5">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-brand-ink mb-1.5 flex items-center gap-1">
                  <span aria-hidden="true">✎</span>
                  Hazır taslak — tıkla, sonra düzenle
                </p>
                <div className="flex flex-col gap-1.5">
                  {quoteTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDescription(tpl)}
                      className="text-left text-[12px] leading-snug text-ink bg-card border border-line rounded-lg px-3 py-2 hover:border-brand-ink hover:shadow-[2px_2px_0_var(--color-brand-ink-12)] hover:-translate-y-0.5 transition-all overflow-hidden"
                    >
                      {/* Clamp iç span'de: <button> üzerinde line-clamp mobil tarayıcılarda güvenilmez */}
                      <span className="line-clamp-2 overflow-hidden break-words">
                        {tpl}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ne yapacağını net şekilde yaz. Örn: 4 saatlik canlı performans, akustik gitar ve vokal. 2 set, ara verilerek..."
              rows={5}
              maxLength={2000}
              className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none"
              required
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {description.length} / 2000 karakter
            </p>
          </div>

          {/* Geçerlilik süresi */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Geçerlilik süresi
            </label>
            <div className="flex flex-wrap gap-2">
              {QUOTE_EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setExpiryKey(opt.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    expiryKey === opt.key
                      ? 'bg-brand-ink text-paper border-brand-ink'
                      : 'bg-card text-ink-72 border-line hover:border-brand-ink/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* İptal politikası */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              İptal politikası (opsiyonel)
            </label>

            {!useCustomPolicy ? (
              <>
                <div className="space-y-2">
                  {CANCELLATION_POLICY_TEMPLATES.map((tmpl) => (
                    <label
                      key={tmpl.key}
                      className={`block bg-card border rounded-lg p-3 cursor-pointer transition ${
                        policyKey === tmpl.key
                          ? 'border-brand-ink'
                          : 'border-line hover:border-brand-ink/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="policy"
                          checked={policyKey === tmpl.key}
                          onChange={() => setPolicyKey(tmpl.key)}
                          className="mt-1 accent-brand-ink"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-ink text-sm">
                            {tmpl.label}
                          </p>
                          <p className="text-xs text-ink-72 mt-1 leading-relaxed">
                            {tmpl.text}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setUseCustomPolicy(true)}
                  className="text-xs text-brand-ink hover:underline mt-2"
                >
                  Kendi politikamı yazayım →
                </button>
              </>
            ) : (
              <>
                <textarea
                  value={customPolicy}
                  onChange={(e) => setCustomPolicy(e.target.value)}
                  placeholder="İptal politikanı buraya yaz..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none"
                />
                <button
                  type="button"
                  onClick={() => setUseCustomPolicy(false)}
                  className="text-xs text-brand-ink hover:underline mt-2"
                >
                  ← Şablonları kullan
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="bg-danger-08 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Butonlar */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-5 py-3 border border-line text-ink-72 rounded-lg font-display font-semibold text-sm hover:bg-card transition"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-5 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? 'Gönderiliyor...' : 'Teklifi gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}