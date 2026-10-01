/**
 * Yönlendirme (return path) sertleştirme — OPEN REDIRECT'e karşı tek merkez.
 *
 * Kabul edilen: YALNIZ aynı origin'e göreli yol.
 *  - tek "/" ile başlar
 *  - "//" (protocol-relative) veya "/\\" ile başlayamaz
 *  - "\\" (backslash) içeremez — tarayıcılar "\" -> "/" normalize eder
 *  - gömülü scheme ("://") içeremez
 *  - control/whitespace kaçış karakteri (\x00-\x1f, \x7f) içeremez
 *  - URL-decode SONRASI da aynı kurallar geçerli (tek/çift-encode kaçışı)
 *
 * Geçemeyen değer sessizce `fallback` olur (varsayılan "/").
 * Ham parametre string'i döndürülür (encoding korunur; URL'e güvenle konur).
 */
export function sanitizeReturnPath(
  raw: string | null | undefined,
  fallback = '/'
): string {
  if (!raw || typeof raw !== 'string') return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback; // bozuk yuzde-encoding
  }

  const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
  const ok = (v: string): boolean =>
    v.startsWith('/') &&
    !v.startsWith('//') &&
    !v.startsWith('/\\') &&
    !v.includes('\\') &&
    !v.includes('://') &&
    !CONTROL_CHARS.test(v);

  // Ham VE decode edilmis - IKISI de gecmeli.
  return ok(raw) && ok(decoded) ? raw : fallback;
}

/**
 * Supabase e-posta sablonundaki `next={{ .RedirectTo }}` degerini YOLA indirir.
 *
 * `RedirectTo`, `signUp`/`resend` cagrisindaki `emailRedirectTo`'nun TAM URL'sidir;
 * parametre Dashboard'daki "Redirect URLs" allowlist'inden gecmezse Supabase onun
 * yerine `SiteURL`'u koyar. Kurallar:
 *  - bos/NULL -> `fallback`
 *  - http(s) ile baslayan deger: ayristirilamazsa ya da BASKA origin ise -> `fallback`;
 *    ayni origin ise yol = `pathname + search` (hash tasinmaz)
 *  - yol `/` (SiteURL'e dusme) ya da `/auth/callback*` / `/auth/confirm*` (ucustaki eski
 *    baglantilar, dongu riski) -> `fallback`
 *  - kalan deger yine `sanitizeReturnPath`'ten gecer (acik yonlendirme sertlestirmesi)
 */
export function returnPathFromRedirectTo(
  raw: string | null | undefined,
  origin: string,
  fallback = '/'
): string {
  if (!raw || typeof raw !== 'string') return fallback;

  let yol = raw;
  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return fallback; // bozuk URL
    }
    if (url.origin !== origin) return fallback;
    yol = url.pathname + url.search;
  }

  if (
    yol === '/' ||
    yol.startsWith('/auth/callback') ||
    yol.startsWith('/auth/confirm')
  ) {
    return fallback;
  }

  return sanitizeReturnPath(yol, fallback);
}
