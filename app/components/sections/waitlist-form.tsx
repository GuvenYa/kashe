"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { supabase } from "@/app/lib/supabase";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setMessage("");

    try {
      const { error } = await supabase
        .from("waitlist")
        .insert({
          email: email.toLowerCase().trim(),
          source: "landing",
          user_agent: navigator.userAgent,
        });

      if (error) {
        // Unique constraint hatası (e-posta zaten kayıtlı)
        if (error.code === "23505") {
          setStatus("success");
          setMessage("Zaten kayıtlısın. Lansman gününde haber vereceğiz.");
          setEmail("");
          return;
        }
        throw error;
      }

      setStatus("success");
      setMessage("Teşekkürler! Lansman gününde e-posta atacağız.");
      setEmail("");
    } catch (err) {
      console.error("Waitlist error:", err);
      setStatus("error");
      setMessage("Bir hata oluştu. Lütfen tekrar dene.");
    }
  }

  return (
    <div className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <Input
          type="email"
          placeholder="E-posta adresiniz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === "loading"}
          className="flex-1"
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Kaydediliyor..." : "Listeye katıl →"}
        </Button>
      </form>

      {status === "success" && (
        <p className="mt-3 text-sm text-moss font-medium">{message}</p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-ember font-medium">{message}</p>
      )}
    </div>
  );
}