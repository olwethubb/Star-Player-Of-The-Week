import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTrophy } from '@/components/ui/Icons';
import { useApprovePayout, useRejectPayout } from '@/hooks/usePayoutActions';
import type { PayoutRequestWithId, PayoutWithId } from '@/context/SessionContext';

function PayoutRow({
  request,
  withActions,
  onApprove,
  onReject,
}: {
  request: PayoutRequestWithId;
  withActions: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const badgeVariant = request.status === 'paid' ? 'solid' : request.status === 'pending' ? 'outline' : 'muted';
  const [confirmingReject, setConfirmingReject] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-soft py-3 last:border-b-0">
      <div className="flex min-w-[150px] flex-1 items-center gap-2">
        <span className="font-display text-sm font-semibold [overflow-wrap:anywhere]">{request.name}</span>
        <Badge variant={badgeVariant}>{request.status}</Badge>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="font-mono text-[13px]">B${request.amount}</span>
        {withActions && (
          <>
            <Button variant="small" onClick={() => onApprove(request.id)}>
              Approve
            </Button>
            <Button variant="danger" onClick={() => setConfirmingReject(true)}>
              Reject
            </Button>
            <ConfirmDialog
              open={confirmingReject}
              onOpenChange={setConfirmingReject}
              title="Reject this payout request?"
              description={`${request.name}'s B$${request.amount} cash-out request will be rejected.`}
              confirmLabel="Reject"
              danger
              onConfirm={() => onReject(request.id)}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function PayoutQueuePanel({ queue, resolvedBy }: { queue: PayoutRequestWithId[]; resolvedBy: string }) {
  const approve = useApprovePayout(resolvedBy);
  const reject = useRejectPayout(resolvedBy);
  const pending = queue.filter((r) => r.status === 'pending');
  const history = queue.filter((r) => r.status !== 'pending').slice(0, 8);

  return (
    <CollapsiblePanel title={`Payout requests${pending.length ? ` (${pending.length})` : ''}`}>
      {pending.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nothing awaiting approval.</p>
      ) : (
        pending.map((r) => <PayoutRow key={r.id} request={r} withActions onApprove={approve} onReject={reject} />)
      )}
      {history.length > 0 && (
        <>
          <p className="mt-3.5 text-xs text-text-muted">Recent history</p>
          {history.map((r) => (
            <PayoutRow key={r.id} request={r} withActions={false} onApprove={approve} onReject={reject} />
          ))}
        </>
      )}
    </CollapsiblePanel>
  );
}

/** Previous weeks' winners and their bonus payouts — data that already existed
 * (every reveal and tie-award writes one of these) but had no view of its own. */
export function PastWinnersPanel({ history }: { history: PayoutWithId[] }) {
  return (
    <CollapsiblePanel title="Past winners">
      {history.length === 0 ? (
        <EmptyState icon={<IconTrophy width={18} height={18} />}>
          Bonus payouts will show up here once a week has been revealed.
        </EmptyState>
      ) : (
        history.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-border-soft py-3 last:border-b-0">
            <span className="font-display text-sm font-semibold [overflow-wrap:anywhere]">{p.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-text-muted">{p.week}</span>
            <span className="ml-auto font-mono text-[13px] font-bold text-accent">+B${p.amount}</span>
          </div>
        ))
      )}
    </CollapsiblePanel>
  );
}
