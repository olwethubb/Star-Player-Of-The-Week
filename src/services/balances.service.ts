import { setDoc } from 'firebase/firestore';
import { balanceRef } from '@/lib/firebase';

export function updateBalance(uid: string, value: number) {
  if (Number.isNaN(value)) return Promise.resolve();
  return setDoc(balanceRef(uid), { balance: value }, { merge: true });
}
