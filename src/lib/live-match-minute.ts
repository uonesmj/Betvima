/** Display only minutes explicitly reported by a football data source.
 * Unknown minutes stay LIVE; we never estimate a match clock from kickoff.
 */
export function matchMinuteLabel(
  minute: number | null | undefined,
  period: string | null | undefined,
): string {
  const phase = (period ?? '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (['ht', 'halftime', 'half_time', 'half_time_break'].includes(phase)) return 'HT';
  if (['ft', 'full_time', 'finished'].includes(phase)) return 'FT';
  if (minute == null || !Number.isInteger(minute) || minute < 0 || minute > 130) return 'LIVE';
  return `${minute}'`;
}
