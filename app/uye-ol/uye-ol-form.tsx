"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Eyebrow } from "@/app/components/ui/eyebrow";
import { createClient } from "@/app/lib/supabase-browser";

type Role = "professional" | "client" | "corporate";

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
  };

  if (errorMap[message]) return errorMap[message];

  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key.substring(0, 30))) return value;
  }

  return message;
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
    title: "Şirketin için tek panel.",
    description: "Otel, fuar şirketi, etkinlik ajansı misin? Toplu ilan yayınla.",
    role: "corporate" as Role,
  },
};

type RoleKey = keyof typeof roleConfig;

export function UyeOlForm({ initialRole }: { initialRole: string }) {
  const supabase = createClient();

  const startingRole: RoleKey =
    initialRole === "profesyonel" || initialRole === "kurumsal"
      ? initialRole
      : "musteri";

  const [role, setRole] = useState<RoleKey>(startingRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const config = roleConfig[role];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/profil`,
          data: {
            full_name: fullName.trim(),
            role: config.role,
          },
        },
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(translateError(rawMessage));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="mb-6 flex justify-center">
          <Eyebrow variant="pill">Kayıt başarılı</Eyebrow>
        </div>
        <h1 className="font-display font-light text-4xl md:text-5xl leading-[1] tracking-[-0.03em] text-ink mb-6">
          Email&apos;ini <em>kontrol</em> et.
        </h1>
        <p className="text-lg text-ink-72 leading-[1.55] mb-10">
          {email} adresine bir doğrulama emaili gönderdik. Hesabını aktifleştirmek için emaildeki linke tıkla.
        </p>
        <p className="text-sm text-ink-50">
          Email gelmediyse spam klasörünü kontrol et.
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
        <h1 className="font-display font-light text-3xl md:text-4xl leading-[1.1] tracking-[-0.03em] text-ink mb-4">
          {config.title}
        </h1>
        <p className="text-base text-ink-72 leading-[1.55]">
          {config.description}
        </p>
      </div>

      <div className="mb-6 flex gap-2">
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta mb-2">
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
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta mb-2">
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
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta mb-2">
            Şifre
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Güçlü bir şifre seç"
            required
            minLength={8}
            disabled={loading}
          />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
            En az 8 karakter · Yaygın şifreleri kullanma
          </p>
        </div>

        {error && (
          <div className="p-3 border border-ember text-sm text-ember">
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
        Zaten üye misin? <a href="/giris" className="text-terracotta hover:text-ink font-medium">Giriş yap</a>
      </p>
    </div>
  );
}