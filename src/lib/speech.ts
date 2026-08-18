/** Speaks a line aloud via the browser's own Web Speech API — runs independently on
 * every device, in whatever voice that device has. Silently no-ops where unsupported. */
export function speak(line: string): void {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(line);
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn('Speech synthesis unavailable:', e);
  }
}
