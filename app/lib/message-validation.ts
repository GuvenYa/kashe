/**
 * Mesaj içeriğini platform-dışı iletişim girişimleri için tarar.
 * Hem server hem client tarafında kullanılır — tek kaynak doğruluk.
 *
 * Politika: telefon, IBAN ve e-posta paylaşımı engellenir.
 * Müşterinin profesyoneli platform dışına çıkarması önlenir
 * (komisyon kaybı + güvenlik).
 *
 * Tasarım: kullanıcı mesajı parça parça (bypass) gönderebilir; bu yüzden
 * regex'ler harf/cümle sınırlarına bakmıyor, ardışık digit bloklarını
 * "telefon imzalı substring" için tarıyor. Sliding window kontrolü
 * (actions.ts) ile birlikte birden fazla mesaja yayılmış paylaşımı yakalar.
 */

export type ViolationType = 'phone' | 'iban' | 'email';

export type MessageValidation = {
  ok: boolean;
  violations: ViolationType[];
};

function hasPhone(text: string): boolean {
  // Text'i digit ve digit-ayırıcı olmayan karakterlerle parçala.
  // Her token'da 10+ hane içinde "telefon imzalı" alt-dizi var mı tara.
  const tokens = text.split(/[^\d\s\-\.\(\)\+]+/);
  for (const token of tokens) {
    const digits = token.replace(/\D/g, '');
    if (digits.length < 10) continue;

    const trimmed = token.trim();

    // Para formatı kontrolü (1.250.000, 15.000,50)
    if (/^\d{1,3}([\.,]\d{3})+([\.,]\d+)?$/.test(trimmed)) continue;

    // Sayısal aralık (15000-30000)
    if (/^\d+\s*-\s*\d+$/.test(trimmed)) continue;
    if (/^\d{1,3}([\.,]\d{3})+\s*-\s*\d{1,3}([\.,]\d{3})+$/.test(trimmed))
      continue;

    // ISO tarih
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) continue;

    // Telefon imzalı alt-dizi tarama: 10-13 hane, 0/5/90 ile başlar
    for (let i = 0; i < digits.length; i++) {
      const remaining = digits.length - i;
      const maxLen = Math.min(13, remaining);
      for (let len = 10; len <= maxLen; len++) {
        const slice = digits.slice(i, i + len);
        if (
          slice[0] === '0' ||
          slice[0] === '5' ||
          (slice[0] === '9' && slice[1] === '0')
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function hasIban(text: string): boolean {
  // 1. Türk IBAN: TR + 24 hane
  const trMatch = text.match(/\bTR[\s]?[\d\s]{24,34}\b/i);
  if (trMatch) {
    const digits = trMatch[0].replace(/\D/g, '');
    if (digits.length >= 24 && digits.length <= 26) return true;
  }

  // 2. Genel IBAN: ülke prefix + hane
  const genericMatch = text.match(/\b[A-Z]{2}\d{2}[\s\d]{11,32}\b/);
  if (genericMatch) {
    const digits = genericMatch[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 32) return true;
  }

  // 3. Prefix'siz uzun digit dizisi (IBAN bypass)
  const longDigitMatches = text.match(/(?:\d[\s\-]?){22,30}\d/g);
  if (longDigitMatches) {
    for (const m of longDigitMatches) {
      const digits = m.replace(/\D/g, '');
      if (digits.length >= 22 && digits.length <= 32) return true;
    }
  }

  return false;
}

function hasEmail(text: string): boolean {
  // @ ve TLD önündeki nokta etrafında boşluk toleransı
  return /[a-zA-Z0-9._%+-]+[\s]{0,3}@[\s]{0,3}[a-zA-Z0-9.-]+[\s]{0,2}\.[\s]{0,2}[a-zA-Z]{2,}/.test(
    text
  );
}

export function validateMessageContent(body: string): MessageValidation {
  const violations: ViolationType[] = [];
  if (hasPhone(body)) violations.push('phone');
  if (hasIban(body)) violations.push('iban');
  if (hasEmail(body)) violations.push('email');
  return {
    ok: violations.length === 0,
    violations,
  };
}

const VIOLATION_LABELS: Record<ViolationType, string> = {
  phone: 'telefon numarası',
  iban: 'IBAN',
  email: 'e-posta adresi',
};

export function formatViolationMessage(violations: ViolationType[]): string {
  if (violations.length === 0) return '';
  const labels = violations.map((v) => VIOLATION_LABELS[v]);
  let joined: string;
  if (labels.length === 1) {
    joined = labels[0];
  } else if (labels.length === 2) {
    joined = `${labels[0]} ve ${labels[1]}`;
  } else {
    joined = `${labels.slice(0, -1).join(', ')} ve ${labels[labels.length - 1]}`;
  }
  return `Mesajında ${joined} var gibi görünüyor. Kashe içinde iletişim daha güvenli — bu bilgileri paylaşmadan platform üzerinden devam edelim.`;
}
