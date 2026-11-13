const TRANSIT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

type DateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

export function getTransitDateTime(now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TRANSIT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  const dateTime = parts as unknown as DateTimeParts;
  return {
    date: `${dateTime.year}-${dateTime.month}-${dateTime.day}`,
    time: `${dateTime.hour}:${dateTime.minute}:${dateTime.second}`,
  };
}

/** Validate a civil lookup instant, not a GTFS service time (which can exceed 24h). */
export function isTransitDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isTransitTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatGtfsTime(value?: string): string {
  if (!value) return '--:--';
  const [hours = '', minutes = ''] = value.split(':');
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return value;
  return `${String(hour).padStart(2, '0')}:${minutes}`;
}
