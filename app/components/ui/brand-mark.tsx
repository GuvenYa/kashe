import Link from 'next/link';
import { KasheMark } from './kashe-mark';
import { KasheWordmark } from './kashe-wordmark';

export function BrandMark({ size = "default" }: { size?: "default" | "lg" }) {
  // Oran lockup ile ayni: kelime isareti, isaretin ~%50 yuksekliginde.
  const dimensions = {
    default: { box: "w-8 h-8", word: "h-4" },
    lg: { box: "w-12 h-12", word: "h-6" },
  };
  const d = dimensions[size];
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <KasheMark className={d.box} title="" />
      <KasheWordmark className={d.word} />
    </Link>
  );
}
