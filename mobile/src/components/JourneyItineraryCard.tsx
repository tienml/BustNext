import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Journey, JourneyLeg } from '../api/client';
import { radius, spacing, useTheme } from '../theme';
import { formatGtfsTime } from '../utils/transitTime';
import { formatServiceDateLabel, getJourneyEndpoints, getLegServiceDate } from '../utils/journeySchedule';
import { Icon } from './ui';

/** A scheduled itinerary: the ribbon and stop timeline come only from its actual legs. */
export function JourneyItineraryCard({ journey, onOpenLeg }: { journey: Journey; onOpenLeg: (leg: JourneyLeg) => void }) {
  const { colors } = useTheme();
  const endpoints = getJourneyEndpoints(journey);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.summary}>
        <View style={styles.timeBlock}>
          <Text style={[styles.caption, { color: colors.muted }]}>Khởi hành → Đến nơi</Text>
          <Text style={[styles.time, { color: colors.ink }]}>{endpoints.departureTime} → {endpoints.arrivalTime}</Text>
          <Text style={[styles.caption, { color: colors.muted }]}>Khởi hành · {endpoints.departureDate}</Text>
          <Text style={[styles.caption, { color: colors.muted }]}>Đến nơi · {endpoints.arrivalDate}</Text>
        </View>
        <View style={[styles.duration, { backgroundColor: colors.primarySoft }]}>
          <Icon name="time-outline" size={18} color={colors.primary} />
          <Text style={[styles.durationText, { color: colors.primary }]}>{journey.duration_minutes} phút</Text>
        </View>
      </View>
      <Text style={[styles.caption, { color: colors.muted }]}>
        {journey.transfers === 0 ? 'Đi thẳng · Không chuyển tuyến' : `${journey.transfers} lần chuyển tuyến`}
      </Text>
      <View style={[styles.ribbon, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.ribbonLabel, { color: colors.muted }]}>LỘ TRÌNH</Text>
        <View style={styles.ribbonLegs}>
          {journey.legs.map((leg, index) => (
            <Fragment key={`${leg.trip_id}-${index}`}>
              {index > 0 ? <Icon name="arrow-forward" size={16} color={colors.muted} /> : null}
              <View style={[styles.routeCode, { backgroundColor: colors.secondarySoft }]}>
                <Icon name="bus-outline" size={16} color={colors.secondary} />
                <Text style={[styles.routeText, { color: colors.secondary }]}>{leg.route_short_name ?? leg.route_id}</Text>
              </View>
            </Fragment>
          ))}
        </View>
      </View>
      {journey.legs.map((leg, index) => (
        <View key={`${leg.trip_id}-${index}`}>
          {index > 0 ? (
            <View style={[styles.transfer, { backgroundColor: colors.warningSurface }]}>
              <Icon name="git-branch-outline" size={18} color={colors.warning} />
              <Text style={[styles.transferText, { color: colors.warning }]}>Chuyển tuyến tại {leg.from.stop_name ?? leg.from.stop_id}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem chuyến tuyến ${leg.route_short_name ?? leg.route_id}, ${formatServiceDateLabel(getLegServiceDate(leg))}, giờ GTFS từ 24:00 tính sang ngày sau ngày dịch vụ, từ ${leg.from.stop_name ?? leg.from.stop_id} lúc ${formatGtfsTime(leg.from.departure_time)}, đến ${leg.to.stop_name ?? leg.to.stop_id} lúc ${formatGtfsTime(leg.to.arrival_time)}`}
            onPress={() => onOpenLeg(leg)}
            style={({ pressed }) => [styles.leg, { borderTopColor: colors.border }, pressed && styles.pressed]}
          >
            <View style={styles.legHeading}>
              <Text style={[styles.legTitle, { color: colors.ink }]}>Tuyến {leg.route_short_name ?? leg.route_id}</Text>
              <Icon name="chevron-forward" size={20} color={colors.muted} />
            </View>
            <Text style={[styles.caption, { color: colors.muted }]}>{formatServiceDateLabel(getLegServiceDate(leg))} · Giờ GTFS từ 24:00 tính sang các ngày tiếp theo sau ngày dịch vụ (25:00 = 01:00 ngày sau).</Text>
            {leg.headsign || leg.route_long_name ? <Text style={[styles.direction, { color: colors.muted }]}>{leg.headsign ?? leg.route_long_name}</Text> : null}
            <View style={styles.stopRow}>
              <View style={styles.track}>
                <View style={[styles.dot, { borderColor: colors.primary, backgroundColor: colors.surface }]} />
                <View style={[styles.line, { backgroundColor: colors.border }]} />
              </View>
              <View style={styles.stopBody}>
                <Text style={[styles.stopTime, { color: colors.ink }]}>{formatGtfsTime(leg.from.departure_time)} <Text style={[styles.caption, { color: colors.muted }]}>· Lên xe</Text></Text>
                <Text style={[styles.stopName, { color: colors.ink }]}>{leg.from.stop_name ?? leg.from.stop_id}</Text>
              </View>
            </View>
            <View style={styles.stopRow}>
              <View style={styles.track}><View style={[styles.destination, { backgroundColor: colors.primary }]} /></View>
              <View style={styles.stopBody}>
                <Text style={[styles.stopTime, { color: colors.ink }]}>{formatGtfsTime(leg.to.arrival_time)} <Text style={[styles.caption, { color: colors.muted }]}>· Xuống xe</Text></Text>
                <Text style={[styles.stopName, { color: colors.ink }]}>{leg.to.stop_name ?? leg.to.stop_id}</Text>
              </View>
            </View>
          </Pressable>
        </View>
      ))}
      <Text style={[styles.footer, { color: colors.muted }]}>Giờ theo lịch GTFS · Chạm từng chặng để xem chuyến</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  summary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  timeBlock: { flexGrow: 1, flexShrink: 1 },
  caption: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  time: { fontSize: 24, lineHeight: 32, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  duration: { borderRadius: radius.sm, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  durationText: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  ribbon: { padding: 12, borderRadius: radius.md, gap: 8, marginVertical: 16 },
  ribbonLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  ribbonLegs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  routeCode: { flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '100%' },
  routeText: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  transfer: { borderRadius: radius.sm, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  transferText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  leg: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingBottom: 8 },
  legHeading: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
  legTitle: { flex: 1, fontSize: 16, fontWeight: '800', lineHeight: 24 },
  direction: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  stopRow: { flexDirection: 'row', gap: 12 },
  track: { width: 16, alignItems: 'center', paddingTop: 5 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  destination: { width: 12, height: 12, borderRadius: 3 },
  line: { width: 2, flex: 1, marginTop: 4, marginBottom: -1 },
  stopBody: { flex: 1, paddingBottom: 16, gap: 2 },
  stopTime: { fontSize: 15, lineHeight: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stopName: { fontSize: 14, lineHeight: 21 },
  footer: { fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72 },
});
