import { describe, expect, it } from 'vitest';
import { AppValidationError, friendlyError } from './errors';

describe('friendlyError', () => {
  it('surfaces the message of the app\'s own validation errors', () => {
    expect(friendlyError(new AppValidationError('You only have B$50 available.'), 'fallback')).toBe(
      'You only have B$50 available.',
    );
  });

  it('never surfaces a raw Firebase-style error, even one with a message', () => {
    const firebaseLike = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    expect(friendlyError(firebaseLike, 'Could not do that. Try again.')).toBe('Could not do that. Try again.');
  });

  it('falls back for a plain thrown value that is not an AppValidationError', () => {
    expect(friendlyError(new Error('boom'), 'fallback')).toBe('fallback');
    expect(friendlyError('boom', 'fallback')).toBe('fallback');
    expect(friendlyError(undefined, 'fallback')).toBe('fallback');
  });
});
