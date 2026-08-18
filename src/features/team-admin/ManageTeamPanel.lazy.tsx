import { lazy } from 'react';

/** Split out so ordinary members never download the team-management bundle. */
export const LazyManageTeamPanel = lazy(() =>
  import('./ManageTeamPanel').then((m) => ({ default: m.ManageTeamPanel })),
);
