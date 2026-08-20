import { lazy } from 'react';

/** Split out so members without finance/admin access never download this bundle. */
export const LazyPayoutQueuePanel = lazy(() =>
  import('./PayoutQueuePanel').then((m) => ({ default: m.PayoutQueuePanel })),
);

export const LazyPastWinnersPanel = lazy(() =>
  import('./PayoutQueuePanel').then((m) => ({ default: m.PastWinnersPanel })),
);
