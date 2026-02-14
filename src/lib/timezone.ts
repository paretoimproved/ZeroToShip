/**
 * Minimal timezone helpers (no external deps).
 *
 * We use these to compute "start of day" boundaries in a specific IANA timezone
 * in a way that is stable regardless of the server's local timezone.
 */

type DateParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
};

function partsToDateParts(parts: Intl.DateTimeFormatPart[]): DateParts {
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);

  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    throw new Error('Failed to parse timezone date parts');
  }

  return { year, month, day, hour, minute, second };
}

/**
 * Returns the timezone offset in milliseconds for `timeZone` at the given instant.
 *
 * The value returned is: (zoned_time_as_utc_ms - instant_utc_ms).
 */
export function getTimeZoneOffsetMs(timeZone: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const zonedParts = partsToDateParts(dtf.formatToParts(instant));
  const zonedAsUtcMs = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second
  );

  return zonedAsUtcMs - instant.getTime();
}

/**
 * Convert a "wall clock" time in an IANA timezone into a UTC Date.
 *
 * This uses a short fixed-point iteration so DST boundaries are handled correctly.
 */
export function zonedWallTimeToUtc(
  timeZone: string,
  wall: { year: number; month: number; day: number; hour: number; minute: number; second: number }
): Date {
  const baseUtcMs = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  let guessMs = baseUtcMs;

  for (let i = 0; i < 3; i++) {
    const offset = getTimeZoneOffsetMs(timeZone, new Date(guessMs));
    const next = baseUtcMs - offset;
    if (Math.abs(next - guessMs) < 1000) {
      guessMs = next;
      break;
    }
    guessMs = next;
  }

  return new Date(guessMs);
}

/**
 * Start-of-day and end-of-day (exclusive) window for "today" in `timeZone`.
 */
export function getTodayWindowUtc(timeZone: string, now: Date = new Date()): { start: Date; end: Date } {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // YYYY-MM-DD

  const [yStr, mStr, dStr] = ymd.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  if (![year, month, day].every(Number.isFinite)) {
    throw new Error(`Failed to derive "today" from timezone "${timeZone}"`);
  }

  const start = zonedWallTimeToUtc(timeZone, { year, month, day, hour: 0, minute: 0, second: 0 });

  // Compute next day in the same timezone, then convert its midnight to UTC.
  // Use a UTC date for stable +1 day arithmetic.
  const nextDayUtc = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const nextYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(nextDayUtc);
  const [nyStr, nmStr, ndStr] = nextYmd.split('-');
  const nextYear = Number(nyStr);
  const nextMonth = Number(nmStr);
  const nextDay = Number(ndStr);

  const end = zonedWallTimeToUtc(timeZone, {
    year: nextYear,
    month: nextMonth,
    day: nextDay,
    hour: 0,
    minute: 0,
    second: 0,
  });

  return { start, end };
}

