import * as RadixToast from '@radix-ui/react-toast';
import { useCallback, useState, type ReactNode } from 'react';
import { ToastContext } from '@/hooks/useToast';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'error' | 'success';
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'error') => {
    const id = nextId++;
    setMessages((prev) => [...prev, { id, text, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      <RadixToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {messages.map((m) => (
          <RadixToast.Root
            key={m.id}
            onOpenChange={(open) => {
              if (!open) dismiss(m.id);
            }}
            className={`rounded-xl border px-4 py-3 text-sm shadow-card font-medium data-[state=open]:animate-fadein ${
              m.tone === 'error'
                ? 'border-accent/40 bg-bg-card text-text'
                : 'border-border bg-bg-elevated text-text'
            }`}
          >
            <RadixToast.Description>{m.text}</RadixToast.Description>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-4 right-4 z-[9999] flex w-[min(92vw,380px)] flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
