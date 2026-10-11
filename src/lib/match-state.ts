/** Match state remains authoritative when a provider leaves an old market flag behind. */
export const LIVE_MATCH_STATUSES = ['live', 'in_play', 'paused', 'break', 'halftime', 'extra_time', 'penalties'];

export const isLiveMatchStatus = (status: string): boolean => LIVE_MATCH_STATUSES.includes(status);
