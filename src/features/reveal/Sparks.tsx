import { useEffect, useState } from 'react';

interface Spark {
  id: number;
  size: number;
  left: number;
  color: string;
  duration: number;
  delay: number;
}

// Real confetti colors, not UI tokens — the accent alone (or worse, --text-muted,
// which is a drab grey-brown) reads as dust rather than celebration on a light page.
const COLORS = [
  'var(--accent)',
  'var(--confetti-gold)',
  'var(--confetti-pink)',
  'var(--confetti-teal)',
  'var(--confetti-violet)',
];
const SPARK_COUNT = 64;

let nextId = 0;

/** A one-shot burst of rising particles, launched once when the winner lands —
 * denser than a typical UI flourish since this is standing in for the payoff of
 * an actual cash bonus, not just a decorative accent. */
export function Sparks() {
  const [sparks, setSparks] = useState<Spark[]>([]);

  useEffect(() => {
    const created = Array.from({ length: SPARK_COUNT }, () => ({
      id: nextId++,
      size: 5 + Math.random() * 7,
      left: 10 + Math.random() * 80,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      duration: 1.8 + Math.random() * 1.4,
      delay: Math.random() * 0.5,
    }));
    setSparks(created);
    const timers = created.map((s) =>
      setTimeout(() => setSparks((prev) => prev.filter((p) => p.id !== s.id)), (s.duration + s.delay) * 1000 + 300),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden="true">
      {sparks.map((s) => (
        <div
          key={s.id}
          className="spark"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.left}vw`,
            background: s.color,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
