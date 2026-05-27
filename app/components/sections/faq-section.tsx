"use client";

import { useState } from "react";
import { Eyebrow } from "@/app/components/ui/eyebrow";

type FaqItem = {
  question: string;
  answer: string;
};

// NOT: FAQ cevapları platformun mevcut/yakın gelecek vaatlerini yansıtır.
// Altyapı değişikliklerinde bu metinler güncellenecek (özellikle ödeme, iptal politikası).
const FAQ: FaqItem[] = [
  {
    question: "Komisyon ödüyor muyum?",
    answer:
      "Kashe lansman döneminde komisyon almıyor — gelen tüm işlerin geliri sana ait. İleride şeffaf bir komisyon modeline geçeceğiz, bunu önceden duyuracağız. Müşteriden de hizmet bedeli dışında ekstra ücret almıyoruz.",
  },
  {
    question: "Profesyoneller nasıl seçiliyor?",
    answer:
      "Her profesyonel başvuruda profil, portföy ve iletişim bilgilerini paylaşır. Ekibimiz bilgileri inceleyip onayladıktan sonra profil yayına alınır. Amacımız Kashe'de gerçek, güvenilir profesyoneller olması — sahte profil yok.",
  },
  {
    question: "Aracı veya ajans var mı?",
    answer:
      "Hayır. Kashe doğrudan iletişim modelidir — müşteri profesyonelle direkt yazışır, fiyat pazarlığı veya ajans kesintisi yok. (Ajanslar ayrı rol olarak platformda var, kendi ekibini yöneten profesyonel ajanslar buraya kayıt olabilir.)",
  },
  {
    question: "Ödeme nasıl güvende?",
    answer:
      "Lansman dönemde iletişim Kashe üzerinden yapılır, ödeme tarafları kendi anlaşmasıyla belirler. Yakın zamanda platform içi güvenli ödeme (iyzico altyapısıyla) ve iş tamamlanınca transfer modeli eklenecek.",
  },
  {
    question: "Etkinlik iptal olursa ne olur?",
    answer:
      "İptal politikası profesyonele göre değişir — her profesyonel kendi şartlarını teklifte belirtir. Lansman sonrası standart iptal/iade politikası eklenecek. Şu an iptal durumunda taraflar aralarında çözer.",
  },
  {
    question: "Profilim ve verilerim güvende mi?",
    answer:
      "Verilerin KVKK uyumlu şekilde saklanır, üçüncü taraflarla paylaşılmaz. Hesabını dilediğin zaman silebilirsin; profil bilgilerin sadece sen ve ekibimiz tarafından görüntülenir.",
  },
];

function FaqItem({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="kashe-tap w-full flex items-center justify-between gap-4 py-5 md:py-6 text-left group"
      >
        <span className="flex items-center gap-4 flex-1 min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-terracotta shrink-0">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="font-display text-lg md:text-xl text-ink group-hover:text-terracotta transition-colors">
            {item.question}
          </span>
        </span>
        <span
          className={`shrink-0 w-7 h-7 rounded-full border border-line flex items-center justify-center transition-all ${
            open ? "bg-terracotta border-terracotta rotate-45" : "group-hover:border-terracotta"
          }`}
          aria-hidden="true"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={open ? "text-paper" : "text-ink-72"}
          >
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100 pb-5 md:pb-6" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-base text-ink-72 leading-[1.65] max-w-3xl pl-[60px] pr-10">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  return (
    <section id="sss" className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        <div className="mb-12 md:mb-16 max-w-2xl">
          <Eyebrow variant="inline" className="mb-4">
            Sıkça sorulanlar
          </Eyebrow>
          <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
            Belki sen de <em>merak ediyorsundur</em>.
          </h2>
        </div>

        <div className="bg-card border border-line rounded-2xl px-6 md:px-10">
          {FAQ.map((item, i) => (
            <FaqItem key={item.question} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
