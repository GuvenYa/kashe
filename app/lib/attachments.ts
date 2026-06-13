/**
 * Mesaj ekleri için ortak sabitler + yardımcılar.
 * 'use server' DEĞİL — saf sabit/fonksiyon, client+server import edebilir.
 *
 * Not: konusma-detay.tsx şu an kendi yerel kopyasını kullanıyor (büyük dosya,
 * dokunulmadı). Yeni modaller bunu kullanır; istenirse konusma-detay da
 * tek satırlık import ile buna geçirilebilir.
 */

export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20 MB

export const ATTACHMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ATTACHMENT_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// <input accept="..."> için hazır string
export const ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function attachmentKind(mime: string): 'image' | 'pdf' | 'doc' | null {
  if (ATTACHMENT_IMAGE_TYPES.includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (ATTACHMENT_DOC_TYPES.includes(mime)) return 'doc';
  return null;
}