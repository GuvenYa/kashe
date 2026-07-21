// Hafif, bağımlılıksız mikro-konfeti. Bir ekran noktasından renkli parçacık saçar.
// Kullanım: burstConfetti(x, y)  — x,y ekran koordinatı (clientX/clientY)
// Faz-1 rebrand paleti: cyan, pembe, lacivert, beyaz.

const COLORS = ["#00ACE2", "#FA0B96", "#040D26", "#FFFFFF"];

export function burstConfetti(x: number, y: number, count = 14) {
  if (typeof window === "undefined") return;
  // prefers-reduced-motion kontrolü
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.pointerEvents = "none";
  container.style.zIndex = "9999";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "kashe-confetti-piece";
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.background = COLORS[i % COLORS.length];

    // rastgele yön/mesafe
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
    const dist = 40 + Math.random() * 50;
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist - 20; // hafif yukarı eğilim
    const cr = `${(Math.random() - 0.5) * 720}deg`;

    piece.style.setProperty("--kashe-cx", `${cx}px`);
    piece.style.setProperty("--kashe-cy", `${cy}px`);
    piece.style.setProperty("--kashe-cr", cr);

    container.appendChild(piece);
  }

  // temizlik
  setTimeout(() => {
    container.remove();
  }, 800);
}
