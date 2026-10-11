/**
 * Settlement windows must be correct across DST transitions and in zones whose local day
 * differs from UTC (Asia/Tehran is UTC+3:30 / +4:30, so "Friday 00:00 local" is Thursday in UTC).
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTLEMENT_SCHEDULE, currentWeeklyPeriod, formatInZone, isValidTimezone, normalizeTimezone,
  settlementWindow, zonedParts, zonedTimeToUtc,
} from '@/lib/timezone';

describe('timezone helpers', () => {
  it('falls back to Asia/Tehran for unknown or empty zones', () => {
    expect(normalizeTimezone('')).toBe('Asia/Tehran');
    expect(normalizeTimezone('Mars/Olympus')).toBe('Asia/Tehran');
    expect(normalizeTimezone('Europe/Berlin')).toBe('Europe/Berlin');
    expect(isValidTimezone('Asia/Tehran')).toBe(true);
    expect(isValidTimezone('nope')).toBe(false);
  });

  it('converts local wall-clock time to UTC in a fixed-offset zone', () => {
    // 2026-01-02 00:00 Tehran (UTC+3:30) = 2026-01-01 20:30 UTC
    const instant = zonedTimeToUtc(2026, 1, 2, 0, 0, 'Asia/Tehran');
    expect(instant.toISOString()).toBe('2026-01-01T20:30:00.000Z');
    expect(zonedParts(instant, 'Asia/Tehran')).toMatchObject({ year: 2026, month: 1, day: 2, hour: 0, minute: 0 });
  });

  it('resolves a window that has already closed and the following one', () => {
    // Saturday 2026-01-03 12:00 Tehran -> the Friday 00:00 window closed 2 days ago.
    const now = new Date('2026-01-03T08:30:00.000Z');
    const window = settlementWindow(now, DEFAULT_SETTLEMENT_SCHEDULE);
    expect(window.periodEnd.toISOString()).toBe('2026-01-01T20:30:00.000Z');
    expect(window.periodStart.toISOString()).toBe('2026-01-08T20:30:00.000Z');
    expect(window.periodEnd.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(window.periodStart.getTime()).toBeGreaterThan(now.getTime());
  });

  it('uses the current instant when it is exactly the settlement moment', () => {
    const exact = zonedTimeToUtc(2026, 1, 2, 0, 0, 'Asia/Tehran');
    const window = settlementWindow(exact, DEFAULT_SETTLEMENT_SCHEDULE);
    expect(window.periodEnd.getTime()).toBe(exact.getTime());
  });

  it('is DST-correct in a zone that changes offset mid-period', () => {
    // Europe/Berlin switches to summer time on 2026-03-29 at 02:00 local.
    const winter = settlementWindow(new Date('2026-03-26T12:00:00Z'), { day: 0, hour: 0, minute: 0, timezone: 'Europe/Berlin' });
    const summer = settlementWindow(new Date('2026-04-06T12:00:00Z'), { day: 0, hour: 0, minute: 0, timezone: 'Europe/Berlin' });
    // 00:00 local is 23:00 UTC the previous day with the winter offset (UTC+1) …
    expect(winter.periodEnd.toISOString()).toBe('2026-03-21T23:00:00.000Z');
    // … and 22:00 UTC with the summer offset (UTC+2). A stored offset would be wrong for one of them.
    expect(summer.periodEnd.toISOString()).toBe('2026-04-04T22:00:00.000Z');
    // Offsets measured from local midnight of the settlement day: UTC+1 before the switch, UTC+2 after.
    const offsetBefore = winter.periodEnd.getTime() - Date.UTC(2026, 2, 22, 0, 0);
    const offsetAfter = summer.periodEnd.getTime() - Date.UTC(2026, 3, 5, 0, 0);
    expect(offsetBefore).toBe(-3_600_000);
    expect(offsetAfter).toBe(-7_200_000);
  });

  it('resolves wall-clock times that do not exist locally (spring-forward gap) deterministically', () => {
    // 2026-03-29 02:30 does not exist in Europe/Berlin; the helper must not throw and must
    // produce an instant inside the affected hour rather than silently drifting a day.
    const instant = zonedTimeToUtc(2026, 3, 29, 2, 30, 'Europe/Berlin');
    expect(Number.isNaN(instant.getTime())).toBe(false);
    expect(instant.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('is correct in a zone with a 45-minute offset (Asia/Kathmandu, UTC+5:45)', () => {
    const instant = zonedTimeToUtc(2026, 6, 5, 0, 0, 'Asia/Kathmandu');
    expect(instant.toISOString()).toBe('2026-06-04T18:15:00.000Z');
  });

  it('derives the weekly period that contains the instant', () => {
    const now = new Date('2026-01-03T08:30:00.000Z'); // Saturday
    const period = currentWeeklyPeriod(now, DEFAULT_SETTLEMENT_SCHEDULE);
    expect(period.start.toISOString()).toBe('2025-12-25T20:30:00.000Z');
    expect(period.end.toISOString()).toBe('2026-01-01T20:30:00.000Z');
    expect(period.end.getTime() - period.start.getTime()).toBe(7 * 86_400_000);
    expect(now.getTime()).toBeGreaterThanOrEqual(period.end.getTime());
  });

  it('formats an instant in its zone (never in server-local time by accident)', () => {
    const instant = new Date('2026-01-01T20:30:00.000Z');
    expect(formatInZone(instant, 'Asia/Tehran', 'en-GB')).toContain('2 Jan 2026');
    expect(formatInZone(instant, 'UTC', 'en-GB')).toContain('1 Jan 2026');
  });
});
