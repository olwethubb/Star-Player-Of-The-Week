import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { useApprovePayout, useRejectPayout } from '@/hooks/usePayoutActions';
import type { PayoutRequestWithId } from '@/context/SessionContext';

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
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-soft py-3 last:border-b-0">
      <div className="flex min-w-[150px] flex-1 items-center gap-2">
        <span className="font-display text-sm font-semibold [overflow-wrap:anywhere]">{request.name}</span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[10px] font-bold tracking-[0.03em] ${
            request.status === 'paid'
              ? 'border-transparent bg-accent text-accent-contrast'
              : request.status === 'pending'
                ? 'border-transparent'
                : 'border-border text-text-muted'
          }`}
        >
          {request.status}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="font-mono text-[13px]">B${request.amount}</span>
        {withActions && (
          <>
            <button
              className="min-h-9 cursor-pointer whitespace-nowrap rounded-full border border-border bg-transparent px-3 py-2 text-xs text-text hover:border-accent hover:text-accent"
              onClick={() => onApprove(request.id)}
            >
              Approve
            </button>
            <button
              className="min-h-9 cursor-pointer whitespace-nowrap rounded-full border border-border bg-transparent px-3 py-2 text-xs text-text hover:border-red-500 hover:text-red-500"
              onClick={() => {
                if (confirm('Reject this payout request?')) onReject(request.id);
              }}
            >
              Reject
            </button>
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
