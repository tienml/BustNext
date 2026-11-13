import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Departure } from '../api/client';
import { radius, spacing, useTheme } from '../theme';
import { formatGtfsTime } from '../utils/transitTime';
import { Icon } from './ui';

type DepartureCardProps = {
  departure: Departure;
  featured?: boolean;
  live: boolean;
  stale: boolean;
  referenceDate: string;
  referenceTime: string;
  onPress: () => void;
};

/** Scheduled departures only: display the API's minutes without estimating vehicle arrival. */
export function DepartureCard({ departure, featured = false, live, stale, referenceDate, referenceTime, onPress }: DepartureCardProps) {
  const { colors } = useTheme();
  const route = departure.route_short_name ?? departure.route_id;
  const destination = departure.headsign ?? 'Chưa có hướng tuyến';
  const time = formatGtfsTime(departure.departure_time);
  const foreground = featured ? colors.onPrimary : colors.ink;
  const secondary = featured ? colors.onPrimary : colors.muted;
  const context = `${live ? 'Mốc tra cứu' : 'Thời điểm đã chọn'} ${referenceDate} · ${referenceTime.slice(0, 5)}`;
  const status = stale ? 'Lịch đã tải · chưa cập nhật' : 'Theo lịch';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${featured ? (stale ? 'Chuyến đầu trong lịch đã tải. ' : 'Chuyến gần nhất theo lịch. ') : ''}Tuyến ${route}, hướng ${destination}, khởi hành ${time}, ngày dịch vụ ${departure.service_date}, theo lịch GTFS, ${departure.minutes_until} phút từ ${live ? 'mốc tra cứu' : 'thời điểm đã chọn'} ${referenceDate} ${referenceTime}${stale ? ', lịch đã tải chưa cập nhật' : ''}`}
      accessibilityHint="Mở chi tiết chuyến xe"
      onPress={onPress}
      style={({ pressed }) => [
        featured ? styles.hero : styles.row,
        featured ? { backgroundColor: colors.primary } : { borderBottomColor: colors.border },
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      {featured ? (
        <View style={styles.topline}>
          <Text style={[styles.eyebrow, { color: foreground }]}>{stale ? 'LỊCH ĐÃ TẢI' : 'CHUYẾN GẦN NHẤT'}</Text>
          <View style={styles.schedule}>
            <Icon name="time-outline" size={16} color={foreground} />
            <Text style={[styles.scheduleText, { color: foreground }]}>Theo lịch</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.routeLine}>
        <View style={[styles.routeBadge, { backgroundColor: featured ? colors.onPrimary : colors.primarySoft }]}>
          <Text style={[styles.routeCode, { color: colors.primary }]}>{route}</Text>
        </View>
        <View style={styles.destination}>
          {featured ? <Text style={[styles.direction, { color: secondary }]}>HƯỚNG ĐẾN</Text> : null}
          <Text style={[featured ? styles.heroDestination : styles.rowDestination, { color: foreground }]}>{destination}</Text>
        </View>
        <Icon name="chevron-forward" size={20} color={secondary} />
      </View>
      <View style={styles.departureLine}>
        <View style={styles.wait}>
          <Text style={[featured ? styles.heroMinutes : styles.rowMinutes, { color: featured ? foreground : colors.primary }]}>{departure.minutes_until}</Text>
          <Text style={[styles.unit, { color: secondary }]}>phút</Text>
        </View>
        <View style={styles.service}>
          <Text style={[styles.departureTime, { color: foreground }]}>Khởi hành {time}</Text>
          <Text style={[styles.detail, { color: secondary }]}>Ngày dịch vụ {departure.service_date}</Text>
        </View>
      </View>
      <View style={[styles.context, featured && { borderTopColor: colors.onPrimary, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <Text style={[styles.detail, { color: secondary }]}>{context}</Text>
        {stale ? (
          <Text style={[styles.status, { color: featured ? foreground : colors.warning }]}>{status}</Text>
        ) : !featured ? <Text style={[styles.detail, { color: secondary }]}>{status}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm, minHeight: 48, gap: spacing.lg },
  row: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 48, gap: spacing.sm },
  topline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  schedule: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduleText: { fontSize: 13, fontWeight: '600' },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routeBadge: { minWidth: 48, minHeight: 48, maxWidth: '35%', padding: spacing.sm, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  routeCode: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  destination: { flex: 1, minWidth: 0, gap: 4 },
  direction: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  heroDestination: { fontSize: 20, fontWeight: '700' },
  rowDestination: { fontSize: 16, fontWeight: '600' },
  departureLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  wait: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 },
  heroMinutes: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rowMinutes: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, fontWeight: '500' },
  service: { flexGrow: 1, flexShrink: 1, gap: 4 },
  departureTime: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  detail: { fontSize: 12, lineHeight: 18 },
  context: { gap: 4, paddingTop: spacing.sm },
  status: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
});
