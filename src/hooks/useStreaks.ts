import { useEffect, useState } from 'react';
import { getDocs, query, where } from 'firebase/firestore';
import { weeklyActivityCol } from '@/lib/firebase';
import { computeStreak } from '@/lib/streak';

/** Fetched once, not a live subscription — this only changes once a week (right
 * after a reveal), so there's no reason to keep it always-on. A small team's whole
 * history here is a few hundred docs at most, cheap to pull in one query. */
export function useStreaks(): Record<string, number> {
  const [streaks, setStreaks] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    getDocs(query(weeklyActivityCol, where('received', '==', true)))
      .then((snap) => {
        if (cancelled) return;
        const byUid = new Map<string, Set<string>>();
        snap.forEach((d) => {
          const { uid, weekKey } = d.data();
          if (!byUid.has(uid)) byUid.set(uid, new Set());
          byUid.get(uid)!.add(weekKey);
        });
        const result: Record<string, number> = {};
        byUid.forEach((weekKeys, uid) => {
          const streak = computeStreak(weekKeys);
          if (streak >= 3) result[uid] = streak;
        });
        setStreaks(result);
      })
      .catch(() => {
        // Cosmetic feature — a failed fetch just means no badges show this load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return streaks;
}
