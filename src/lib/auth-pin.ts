const PIN_LENGTH = 4;
const PIN_PATTERN = /^\d{4}$/;

export function isValidPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}

export const PIN_LABEL = `${PIN_LENGTH}-digit PIN`;

/** Firebase Auth rejects any password under 6 characters, so a bare 4-digit PIN
 * can never be the literal stored password — it's doubled to 8 characters instead.
 * This can never collide with a genuine password: Firebase would already have
 * rejected anything under 6 characters at creation time, so a secret that's
 * exactly 4 digits only ever means a PIN. */
export function pinToPassword(pin: string): string {
  return pin + pin;
}

/** The login field has to accept either a PIN-based account's PIN or an existing
 * account's real (longer) password, with nothing in the UI telling it which —
 * see pinToPassword for why testing "exactly 4 digits" is unambiguous. */
export function resolveLoginSecret(input: string): string {
  return isValidPin(input) ? pinToPassword(input) : input;
}
