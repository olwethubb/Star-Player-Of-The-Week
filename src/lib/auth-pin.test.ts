import { describe, expect, it } from 'vitest';
import { isValidPin, pinToPassword, resolveLoginSecret } from './auth-pin';

describe('isValidPin', () => {
  it('accepts exactly 4 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('0000')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });
});

describe('pinToPassword', () => {
  it('doubles the PIN to clear Firebase\'s 6-character minimum', () => {
    expect(pinToPassword('1234')).toBe('12341234');
    expect(pinToPassword('1234')).toHaveLength(8);
  });
});

describe('resolveLoginSecret', () => {
  it('pads a 4-digit PIN', () => {
    expect(resolveLoginSecret('1234')).toBe('12341234');
  });

  it('passes a real password through unchanged — no legitimate password can ever be 4 characters', () => {
    expect(resolveLoginSecret('Demo-Pass-2026!')).toBe('Demo-Pass-2026!');
  });
});
