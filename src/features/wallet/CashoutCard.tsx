import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Field';
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
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
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
        <Button variant="small" onClick={() => cancelCashout(myPayout.id)}>
          Cancel request
        </Button>
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
    setPendingAmount(amount);
  }

  return (
    <div className="mb-5 rounded-2xl border border-border bg-bg-card p-4 shadow-card">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13px] text-text-muted">Your balance</span>
        <span className="font-mono text-lg font-bold">B${(balance || 0).toLocaleString()}</span>
      </div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label="Amount to cash out"
            type="number"
            min={1}
            max={balance}
            step={1}
            inputMode="numeric"
            placeholder="0"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
        </div>
        <Button variant="ghost" disabled={pending} onClick={handleSubmit}>
          Cash Out
        </Button>
      </div>
      <ConfirmDialog
        open={pendingAmount !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAmount(null);
        }}
        title="Request this cash-out?"
        description={`B$${pendingAmount ?? 0} will be requested.${financeName ? ` ${financeName} will review it.` : ''}`}
        confirmLabel="Request cash-out"
        onConfirm={() => {
          if (pendingAmount != null) requestCashout(pendingAmount);
          setAmountInput('');
          setPendingAmount(null);
        }}
      />
    </div>
  );
}
