import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

/** In-system replacement for native `confirm()` — same "are you sure" job, but styled
 * like the rest of the app instead of breaking out into OS chrome. Controlled (rather
 * than trigger-based) so a caller can gate opening it behind its own validation. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[9998] bg-black/60 data-[state=open]:animate-fadein" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[9999] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-bg-card p-5 shadow-card focus:outline-none data-[state=open]:animate-fadein">
          <AlertDialog.Title className="m-0 mb-1.5 font-display text-base font-bold text-text">{title}</AlertDialog.Title>
          <AlertDialog.Description className="m-0 mb-5 text-sm leading-relaxed text-text-muted">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-2.5">
            <AlertDialog.Cancel asChild>
              <Button variant="small">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={danger ? 'danger' : 'small'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
