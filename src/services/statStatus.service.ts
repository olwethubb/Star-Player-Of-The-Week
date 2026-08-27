import { setDoc } from 'firebase/firestore';
import { statStatusRef } from '@/lib/firebase';
import { getWeekKey } from '@/lib/week';
import type { StatLevel } from '@/types/firestore';

/** Declares (or changes) the caller's own stats for the CURRENT week. Only
 * 'up' makes them votable this week — firestore.rules is the actual gate
 * (isUpThisWeek), this just writes the declaration it reads. */
export function declareMyStatus(uid: string, status: StatLevel) {
  return setDoc(statStatusRef(uid), { weekKey: getWeekKey(), status });
}
