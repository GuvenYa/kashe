/**
 * Mesaj içeriğini platform-dışı iletişim girişimleri için tarar.
 * Hem server hem client tarafında kullanılır — tek kaynak doğruluk.
 *
 * Politika: telefon, IBAN ve e-posta paylaşımı engellenir.
 * Müşterinin profesyoneli platform dışına çıkarması önlenir
 * (komisyon kaybı + güvenlik).
 *
 * Regex'ler 25+ gerçek senaryoda test edildi —
 * para aralıkları, tarihler, saatler false positive vermemeli.
 */

export type ViolationType = 'phone' | 'iban' | 'email';

export type MessageValidation = {
  ok: boolean;
  violations: ViolationType[];
};

function hasPhone(text: string): boolean {
  // 10-15 rakam içeren, ayırıcılı veya bitişik dizileri tara
  const matches = text.match(/(?:\+?\d[\d\s\-\.\(\)]{8,}\d)/g);
  if (!matches) return false;

  for (const m of matches) {
    const trimmed = m.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) continue;

    // Para formatı — 1.250.000 veya 15.000,50 gibi
    if (/^\d{1,3}([\.,]\d{3})+([\.,]\d+)?$/.test(trimmed)) continue;

    // Sayısal aralık — "15000-30000" veya "15.000-30.000"
    if (/^\d+\s*-\s*\d+$/.test(trimmed)) continue;
    if (/^\d{1,3}([\.,]\d{3})+\s*-\s*\d{1,3}([\.,]\d{3})+$/.test(trimmed))
      continue;

    // ISO tarih + saat (2026-05-29 21:07)
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) continue;

    // Telefon imzası: + ile başla veya 0/90/5 ile devam et
    const digitsStart = digits.slice(0, 2);
    const startsWithPhoneSig =
      /^\+?\d/.test(trimmed) &&
      (digits.startsWith('0') ||
        digits.startsWith('90') ||
        digitsStart.startsWith('5'));
    if (!startsWithPhoneSig) continue;

    return true;
  }
  return false;
}

function hasIban(text: string): boolean {
  // Türk IBAN: TR + 24 hane (boşluklu da olabilir)
  const trMatch = text.match(/\bTR[\s]?[\d\s]{24,34}\b/i);
  if (trMatch) {
    const digits = trMatch[0].replace(/\D/g, '');
    if (digits.length >= 24 && digits.length <= 26) return true;
  }

  // Genel IBAN: 2 harf ülke + 2 hane + en az 11 hane
  const genericMatch = text.match(/\b[A-Z]{2}\d{2}[\s\d]{11,32}\b/);
  if (genericMatch) {
    const digits = genericMatch[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 32) return true;
  }
  return false;
}

function hasEmail(text: string): boolean {
  // @ etrafında 0-3 boşluk olabilir — bypass dene yakalansın
  return /[a-zA-Z0-9._%+-]+[\s]{0,3}@[\s]{0,3}[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(
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
