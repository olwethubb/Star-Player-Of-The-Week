import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sotw:tts-enabled';

function readStored(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEY) !== 'false';
}

/** Whether the reveal ceremony's spoken (Web Speech API) announcement should play.
 * A per-device preference, not account state — it's about whether THIS speaker
 * should talk, not something that should follow someone across devices. The
 * on-screen winner text (WinnerPopup/WinnerBlock) is unaffected either way; speech
 * is always a pure enhancement on top of it, never the only channel. */
export function useTtsPreference(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(readStored);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return [enabled, toggle];
}
