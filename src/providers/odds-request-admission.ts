/**
 * The Odds API is rate-limited across both base-price and optional per-event calls.
 * Admission is serialized, but core price updates must have priority so that a
 * large extended-market backlog cannot exhaust the prematch freshness window.
 * The returned release callback is idempotent even if an exception occurs.
 */
export type RequestPriority = 'core' | 'extended';

export function createRequestAdmissionQueue() {
  type Permit = () => void;
  type Waiter = (permit: Permit) => void;
  let occupied = false;
  const core: Waiter[] = [];
  const extended: Waiter[] = [];

  const dispatch = () => {
    if (occupied) return;
    const next = core.shift() ?? extended.shift();
    if (!next) return;
    occupied = true;
    let returned = false;
    next(() => {
      if (returned) return;
      returned = true;
      occupied = false;
      dispatch();
    });
  };

  return {
    acquire(priority: RequestPriority = 'core'): Promise<Permit> {
      return new Promise((resolve) => {
        (priority === 'extended' ? extended : core).push(resolve);
        dispatch();
      });
    },
  };
}
