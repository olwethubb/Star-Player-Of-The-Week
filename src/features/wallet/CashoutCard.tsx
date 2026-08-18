import { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { useCancelCashout, useRequestCashout } from '@/hooks/usePayoutActions';
import type { PayoutRequestWithId } from '@/context/SessionContext';
import type { Profile } from '@/types/firestore';

interface CashoutCardProps {
  uid: string;
  profile: Profile;
  balance: number;
  myPayout: PayoutRequestWithId | null;
  financeName: string | null;
}

export function CashoutCard({ uid, profile, balance, myPayout, financeName }: CashoutCardProps) {
  const [amountInput, setAmountInput] = useState('');
  const { notify } = useToast();
  const { requestCashout, pending } = useRequestCashout(uid, profile, !!myPayout, balance);
  const cancelCashout = useCancelCashout();

  if (myPayout) {
    return (
      <div className="mb-5 rounded-2xl border border-border bg-bg-card p-4 shadow-card">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[13px] text-text-muted">Your balance</span>
          <span className="font-mono text-lg font-bold">B${(balance || 0).toLocaleString()}</span>
        </div>
        <div className="mb-2.5 text-[13px] text-text-muted">
          Cash-out of B${myPayout.amount} requested — awaiting review
        </div>
        <button
          className="min-h-9 cursor-pointer rounded-full border border-border bg-transparent px-3 py-2 text-xs text-text hover:border-accent hover:text-accent"
          onClick={() => cancelCashout(myPayout.id)}
        >
          Cancel request
        </button>
      </div>
    );
  }

  if (balance <= 0) return null;

  function handleSubmit() {
    const amount = Math.floor(Number(amountInput));
    if (!amount || amount <= 0) {
      notify('Enter an amount to cash out.');
      return;
    }
    if (amount > (balance || 0)) {
      notify(`You only have B$${balance || 0} available.`);
      return;
    }
    if (confirm(`Request a cash-out of B$${amount}?${financeName ? ` ${financeName} will review it.` : ''}`)) {
      requestCashout(amount);
      setAmountInput('');
    }
  }

  return (
    <div className="mb-5 rounded-2xl border border-border bg-bg-card p-4 shadow-card">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13px] text-text-muted">Your balance</span>
        <span className="font-mono text-lg font-bold">B${(balance || 0).toLocaleString()}</span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={balance}
          step={1}
          inputMode="numeric"
          placeholder="Amount"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-bg-elevated px-3 py-2.5 font-mono text-base text-text focus:border-accent focus:outline-none"
        />
        <button
          disabled={pending}
          onClick={handleSubmit}
          className="min-h-[46px] cursor-pointer whitespace-nowrap rounded-full border border-border bg-transparent px-5 py-3 text-sm font-semibold text-text hover:border-accent hover:text-accent disabled:opacity-60"
        >
          Cash Out
        </button>
      </div>
    </div>
  );
}
