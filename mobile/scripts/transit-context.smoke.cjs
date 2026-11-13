const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename });
  return module.exports;
}

const time = load('src/utils/transitTime.ts');
const schedule = load('src/utils/journeySchedule.ts', { './transitTime': time });
function leg(date, departure, arrival) {
  return { trip_id: date, service_date: date,
    from: { departure_time: departure }, to: { arrival_time: arrival } };
}
const previous = leg('2026-12-31', '25:00:00', '25:15:00');
const current = leg('2027-01-01', '01:20:00', '02:00:00');
const journey = { departure_time: '25:00:00', arrival_time: '26:00:00',
  service_date: '2026-12-31', duration_minutes: 60, legs: [previous, current] };
const endpoints = schedule.getJourneyEndpoints(journey);
assert.equal(endpoints.departureTime, '25:00');
assert.equal(endpoints.arrivalTime, '02:00');
assert.equal(endpoints.departureDate, 'Ngày dịch vụ 2026-12-31');
assert.equal(endpoints.arrivalDate, 'Ngày dịch vụ 2027-01-01');
assert.equal(journey.duration_minutes, 60);
assert.equal(journey.legs[0], previous);
assert.equal(schedule.getLegServiceDate({ from: { service_date: '2024-02-29' }, to: {} }), '2024-02-29');
assert.equal(schedule.getLegServiceDate({ from: {}, to: {} }), undefined);
assert.equal(schedule.formatServiceDateLabel(), 'Chưa chọn ngày dịch vụ');
assert.equal(schedule.getJourneyEndpoints({ ...journey, legs: [] }).arrivalDate, 'Chưa chọn ngày dịch vụ');
assert.equal(time.formatGtfsTime('49:05:00'), '49:05');

let stateCalls = 0;
let requested;
const hooks = load('src/hooks/useTransitQueries.ts', {
  react: { useEffect() {}, useState() { stateCalls += 1; return ['old keyword', () => {}]; } },
  '@tanstack/react-query': { useQuery: (options) => options },
  '../api/client': { apiClient: { searchTrips: (filters) => { requested = filters; } }, ApiError: class extends Error {} },
});
const filters = { q: ' new keyword ', route_id: ' new-route ', route_type: 0, direction_id: 0, date: '2027-01-01', limit: 25 };
const query = hooks.useTripSearch(filters);
assert.equal(stateCalls, 1, 'Only the live keyword should be debounced');
const normalized = query.queryKey[1];
assert.equal(normalized.q, 'old keyword');
assert.equal(normalized.route_id, 'new-route');
assert.equal(normalized.route_type, 0);
assert.equal(normalized.direction_id, 0);
assert.equal(normalized.date, '2027-01-01');
assert.equal(normalized.limit, 25);
query.queryFn({ signal: undefined });
assert.equal(requested, normalized, 'The request and cache key must use the same filters');
const undated = hooks.useTripSearch({ route_id: ' ', date: undefined }, false);
assert.equal(undated.queryKey[1].route_id, '');
assert.equal(undated.queryKey[1].date, undefined);
assert.equal(undated.enabled, false);
console.log('PASS: mixed service-day endpoints, raw extended GTFS hours, undated fallback, unchanged duration/order, and synchronous applied filters with debounced keyword.');
