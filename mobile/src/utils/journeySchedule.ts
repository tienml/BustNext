import type { Journey, JourneyLeg } from '../api/client';
import { formatGtfsTime } from './transitTime';

/** A leg's service day is not necessarily the itinerary's first service day. */
export function getLegServiceDate(leg: JourneyLeg): string | undefined {
  return leg.service_date ?? leg.from.service_date ?? leg.to.service_date;
}

export function formatServiceDateLabel(serviceDate?: string): string {
  return serviceDate ? `Ngày dịch vụ ${serviceDate}` : 'Chưa chọn ngày dịch vụ';
}

/** Keep raw GTFS hours and label each endpoint's own service day, without timezone conversion. */
export function getJourneyEndpoints(journey: Journey) {
  const first = journey.legs[0];
  const last = journey.legs[journey.legs.length - 1];
  return {
    departureTime: formatGtfsTime(first?.from.departure_time ?? journey.departure_time),
    arrivalTime: formatGtfsTime(last?.to.arrival_time ?? journey.arrival_time),
    departureDate: formatServiceDateLabel(first ? getLegServiceDate(first) : undefined),
    arrivalDate: formatServiceDateLabel(last ? getLegServiceDate(last) : undefined),
  };
}
