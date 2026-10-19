import { ApiError } from '@/lib/errors';

const DAY_MS = 86_400_000;

function validDay(text: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ApiError('BAD_REQUEST', 'Date must use YYYY-MM-DD');
  const millis = Date.parse(text + 'T00:00:00.000Z');
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0,10) !== text) {
    throw new ApiError('BAD_REQUEST','Invalid calendar date');
  }
  return millis;
}

/** The report date is the affiliate's business day, not the device's timezone. */
export function referralDateRange(from: string|null,to: string|null, timezone: string) {
  let end = to;
  let start = from;
  if (!start && !end) {
    const parts = new Intl.DateTimeFormat('en-CA',{
      timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',
    }).formatToParts(new Date());
    const value = (name:string) => parts.find(p=>p.type===name)?.value??'';
    end = `${value('year')}-${value('month')}-${value('day')}`;
    start = new Date(validDay(end)-6*DAY_MS).toISOString().slice(0,10);
  }
  if (!start || !end) throw new ApiError('BAD_REQUEST','from and to must be supplied together');
  const a = validDay(start);
  const b = validDay(end);
  if (b<a || (b-a)/DAY_MS>=366) {
    throw new ApiError('BAD_REQUEST','Date range must be between 1 and 366 days');
  }
  return {from:start,to:end,timezone};
}
