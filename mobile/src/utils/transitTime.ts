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

export function formatGtfsTime(value?: string): string {
  if (!value) return '--:--';
  const [hours = '', minutes = ''] = value.split(':');
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return value;
  return `${String(hour).padStart(2, '0')}:${minutes}`;
}
