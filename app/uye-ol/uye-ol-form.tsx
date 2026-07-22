"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Eyebrow } from "@/app/components/ui/eyebrow";
import { createClient } from "@/app/lib/supabase-browser";

type Role = "professional" | "client" | "business";

function translateError(message: string): string {
  const errorMap: Record<string, string> = {
    "Password is known to be weak and easy to guess, please choose a different one.":
      "Bu şifre çok yaygın ve tahmin edilmesi kolay. Lütfen daha güçlü bir şifre seç.",
    "User already registered":
      "Bu email zaten kayıtlı. Giriş yapmayı dene.",
    "Invalid email or password":
      "E-posta veya şifre hatalı.",
    "Password should be at least 8 characters.":
      "Şifre en az 8 karakter olmalı.",
    "Email rate limit exceeded":
      "Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.",
    "Unable to validate email address: invalid format":
      "Geçerli bir email adresi gir.",
    "Signup requires a valid password":
      "Geçerli bir şifre girmelisin.",
    "Error sending confirmation email":
      "Doğrulama e-postası gönderilemedi. Lütfen birkaç dakika sonra tekrar dene.",
  };

  if (errorMap[message]) return errorMap[message];

  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key.substring(0, 30))) return value;
  }

  return message;
}

/**
 * Hatadan GÜVENLİ metin çıkarır. Error nesnesi JSON.stringify'dan geçirilmez
 * (message non-enumerable → "{}"): mesaj Error/düz nesne/string'ten okunur;
 * anlamsız serileştirme çıktıları ("{}", "[]", "[object Object]", boş) → "" (genel mesaja düş).
 */
function errorToMessage(err: unknown): string {
  let raw = "";
  if (typeof err === "string") raw = err;
  else if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    raw = (err as { message: string }).message;
  }
  raw = raw.trim();
  if (!raw || raw === "{}" || raw === "[]" || raw === "[object Object]") return "";
  return raw;
}

const roleConfig = {
  profesyonel: {
    label: "Profesyonel",
    eyebrow: "Hizmet ver",
    title: "Profilini aç, çalışmaya başla.",
    description: "Etkinlik sektöründe profesyonelsen, profilini oluştur, müşterilerle bağlan.",
    role: "professional" as Role,
  },
  musteri: {
    label: "Müşteri",
    eyebrow: "Hizmet ara",
    title: "Doğru profesyoneli bul.",
    description: "Etkinliğin için hostes, DJ, fotoğrafçı mı arıyorsun? Hızlıca kayıt ol.",
    role: "client" as Role,
  },
  kurumsal: {
    label: "Kurumsal",
    eyebrow: "Kurumsal hesap",
    title: "Şirketiniz için Kashe.",
    description: "Otel, fuar veya kurumsal etkinlik ekibi misiniz? Şirket adınızla ilan açın, çok sayıda profesyonelden teklif toplayın.",
    role: "business" as Role,
  },
};

type RoleKey = keyof typeof roleConfig;

type CityOption = { id: number; name: string };

export function UyeOlForm({
  initialRole,
  cities,
}: {
  initialRole: string;
  cities: CityOption[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Güvenlik: sadece site-içi yollara izin
  const rawRedirect = searchParams.get("redirect");
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/profil";

  const startingRole: RoleKey =
    initialRole === "profesyonel" || initialRole === "kurumsal"
      ? initialRole
      : "musteri";

  const [role, setRole] = useState<RoleKey>(startingRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Telefon: kullanıcı sadece "5XX XXX XX XX" girer, +90 sabit prefix.
  // DB'ye +905XXXXXXXXX olarak gider.
  const [phone, setPhone] = useState("");
  const [cityId, setCityId] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const config = roleConfig[role];

  // Telefon maskeleme: ham rakamları "5XX XXX XX XX" formatına çevir
  function formatPhone(raw: string): string {
    // Sadece rakamları al, baştaki 0/90'ı temizle, max 10 hane (5XXXXXXXXX)
    let digits = raw.replace(/\D/g, "");
    // Kullanıcı 0 ya da 90 ile başlarsa temizle
    if (digits.startsWith("90")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = digits.slice(0, 10); // 5XX XXX XX XX = 10 hane

    // Formatla: 5XX XXX XX XX
    const parts: string[] = [];
    if (digits.length > 0) parts.push(digits.slice(0, 3));
    if (digits.length > 3) parts.push(digits.slice(3, 6));
    if (digits.length > 6) parts.push(digits.slice(6, 8));
    if (digits.length > 8) parts.push(digits.slice(8, 10));
    return parts.join(" ");
  }

  // Maskeli görünümden ham haneleri çıkar (DB için)
  function phoneDigits(masked: string): string {
    return masked.replace(/\D/g, "").slice(0, 10);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Telefon ZORUNLU: 10 hane değilse hata
      const digits = phoneDigits(phone);
      if (digits.length !== 10) {
        setError("Geçerli bir telefon numarası gir (5XX XXX XX XX).");
        setLoading(false);
        return;
      }
      const fullPhone = `+90${digits}`;

      // Şehir ZORUNLU
      if (!cityId) {
        setError("Lütfen şehrini seç.");
        setLoading(false);
        return;
      }

      // KVKK ZORUNLU
      if (!kvkk) {
        setError("Devam etmek için KVKK ve kullanım şartlarını onaylamalısın.");
        setLoading(false);
        return;
      }

      const mail = email.toLowerCase().trim();
      if (!mail) {
        setError("E-posta adresini gir.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/profil`,
          data: {
            full_name: fullName.trim(),
            role: config.role,
            phone: fullPhone,
            city_id: cityId,
            kvkk_approved: "true",
          },
        },
      });

      if (error) throw error;

      // "Confirm email" AÇIK + e-posta enumeration koruması: ZATEN KAYITLI e-posta →
      // user döner ama identities BOŞ, error gelmez. Kullanıcıya anlaşılır mesaj.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("Bu e-posta zaten kayıtlı. Giriş yapmayı ya da şifreni sıfırlamayı dene.");
        setLoading(false);
        return;
      }

      // Confirm AÇIK → signUp oturum DÖNDÜRMEZ → /profil'e redirect DENEME;
      // yerinde "e-postanı doğrula" durumunu göster.
      if (!data.session) {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Oturum var (confirm KAPALI / otomatik onay) → mevcut davranış: hedefe yönlendir.
      router.push(redirectTo);
      router.refresh();
      return;
    } catch (err: unknown) {
      // Ham hatayı teşhis için logla (kaybolmasın); kullanıcıya ASLA stringify'lı nesne gösterme.
      console.error("[uye-ol] signUp hata:", err);
      const raw = errorToMessage(err);
      setError(
        raw
          ? translateError(raw)
          : "Kayıt sırasında bir sorun oluştu. Lütfen tekrar dene."
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="mb-6 flex justify-center">
          <Eyebrow variant="pill">Kayıt alındı</Eyebrow>
        </div>
        <h1 className="font-display font-semibold text-4xl md:text-5xl leading-[1] tracking-[-0.03em] text-ink mb-6">
          E-postanı <em>doğrula</em>.
        </h1>
        <p className="text-lg text-ink-72 leading-[1.55] mb-6">
          <strong className="text-ink">{email}</strong> adresine bir doğrulama bağlantısı
          gönderdik. Hesabını aktifleştirmek için bağlantıya tıkla.
        </p>
        <p className="text-base text-ink-72 mb-8">
          Gelen kutunu <em>(ve spam klasörünü)</em> kontrol et.
        </p>
        <p className="text-sm text-ink-50">
          Doğruladıktan sonra otomatik giriş yapılır ve profiline yönlendirilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <Eyebrow variant="pill">{config.eyebrow}</Eyebrow>
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl leading-[1.1] tracking-[-0.03em] text-ink mb-4">
          {config.title}
        </h1>
        <p className="text-base text-ink-72 leading-[1.55]">
          {config.description}
        </p>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setRole("profesyonel")}
          className={`flex-1 py-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] border transition-colors ${
            role === "profesyonel"
              ? "bg-ink text-paper border-ink"
              : "bg-transparent text-ink-72 border-line hover:border-ink"
          }`}
        >
          Profesyonel
        </button>
        <button
          type="button"
          onClick={() => setRole("musteri")}
          className={`flex-1 py-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] border transition-colors ${
            role === "musteri"
              ? "bg-ink text-paper border-ink"
              : "bg-transparent text-ink-72 border-line hover:border-ink"
          }`}
        >
          Müşteri
        </button>
        <button
          type="button"
          onClick={() => setRole("kurumsal")}
          className={`flex-1 py-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] border transition-colors ${
            role === "kurumsal"
              ? "bg-ink text-paper border-ink"
              : "bg-transparent text-ink-72 border-line hover:border-ink"
          }`}
        >
          Kurumsal
        </button>
      </div>

      {/* Ajans ayrı bir kayıt akışı — 3 ana rolün altında ikincil ipucu (buton değil) */}
      <p className="mb-6 text-center text-xs text-ink-72">
        Ajans mı yönetiyorsunuz?{" "}
        <a
          href="/uye-ol/ajans"
          className="text-brand-ink hover:text-ink font-medium"
        >
          Ajans hesabı oluşturun →
        </a>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-brand-ink mb-2">
            Ad Soyad
          </label>
          <Input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ad Soyad"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-brand-ink mb-2">
            E-posta
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@email.com"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-brand-ink mb-2">
            Telefon <span className="text-danger">*</span>
          </label>
          <div className="flex items-stretch gap-2">
            <span className="inline-flex items-center px-3 bg-card border border-line rounded-lg text-ink font-mono text-sm select-none">
              +90
            </span>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="5XX XXX XX XX"
              disabled={loading}
              className="flex-1 w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
            />
          </div>
          {phone && phoneDigits(phone).length > 0 && phoneDigits(phone).length < 10 && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
              Numara eksik görünüyor (10 hane: 5XX XXX XX XX)
            </p>
          )}
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-brand-ink mb-2">
            Şifre
          </label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Güçlü bir şifre seç"
              required
              minLength={8}
              disabled={loading}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-50 hover:text-ink-72 transition-colors"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
            En az 8 karakter · Yaygın şifreleri kullanma
          </p>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-brand-ink mb-2">
            Şehir <span className="text-danger">*</span>
          </label>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition appearance-none cursor-pointer"
          >
            <option value="">Şehrini seç</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-3 pt-1">
          <input
            id="kvkk"
            type="checkbox"
            checked={kvkk}
            onChange={(e) => setKvkk(e.target.checked)}
            disabled={loading}
            className="mt-0.5 w-4 h-4 shrink-0 accent-brand-ink cursor-pointer"
          />
          <label htmlFor="kvkk" className="text-sm text-ink-72 leading-snug cursor-pointer">
            <a href="/kvkk" target="_blank" rel="noopener noreferrer" className="text-brand-ink hover:text-ink underline">KVKK Aydınlatma Metni</a>
            {"'ni ve "}
            <a href="/kullanim-kosullari" target="_blank" rel="noopener noreferrer" className="text-brand-ink hover:text-ink underline">Kullanım Koşulları</a>
            {"'nı okudum, onaylıyorum."}
          </label>
        </div>

        {error && (
          <div className="p-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={loading}
          className="w-full"
        >
          {loading ? "Kaydediliyor..." : "Hesap oluştur"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-72">
        Zaten üye misin?{" "}
        <a
          href={
            rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
              ? `/giris?redirect=${encodeURIComponent(rawRedirect)}`
              : "/giris"
          }
          className="text-brand-ink hover:text-ink font-medium"
        >
          Giriş yap
        </a>
      </p>
    </div>
  );
}