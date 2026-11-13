import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StopTime } from '../api/client';
import { spacing, useTheme } from '../theme';
import { formatGtfsTime } from '../utils/transitTime';
import { Icon } from './ui';

/** Only use with the stop_times of an individual trip, ordered by stop_sequence. */
export function RouteStopTimeline({ item, first, last, onPress }: { item: StopTime; first: boolean; last: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  const name = item.stop_name ?? item.stop?.name ?? item.stop_id;
  const arrival = formatGtfsTime(item.arrival_time);
  const departure = formatGtfsTime(item.departure_time);
  const time = formatGtfsTime(item.departure_time ?? item.arrival_time);
  const phase = first && last ? 'Điểm dừng duy nhất' : first ? 'Điểm đầu chuyến' : last ? 'Điểm cuối chuyến' : `Điểm dừng ${item.stop_sequence}`;
  const times = item.arrival_time && item.departure_time && item.arrival_time !== item.departure_time
    ? `Đến ${arrival} · Rời ${departure}` : `Theo lịch ${time}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${phase}, ${name}, ${times}`} accessibilityHint="Xem thông tin trạm" onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.primarySoft }]}>
      <View style={styles.rail} importantForAccessibility="no-hide-descendants">
        <View style={[styles.segment, { backgroundColor: first ? 'transparent' : colors.primary }]} />
        <View style={[styles.dot, { borderColor: colors.primary, backgroundColor: first || last ? colors.primary : colors.surface }]} />
        <View style={[styles.segment, { backgroundColor: last ? 'transparent' : colors.primary }]} />
      </View>
      <View style={[styles.body, { borderBottomColor: colors.border }, stacked && styles.stacked]}>
        {!stacked ? <Text style={[styles.clock, { color: colors.primary }]}>{time}</Text> : null}
        <View style={styles.copy}>
          <Text style={[styles.phase, { color: first || last ? colors.primary : colors.muted }]}>{phase}</Text>
          <Text style={[styles.name, { color: colors.ink }]}>{name}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{times}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{item.stop_code ?? item.stop_id}</Text>
        </View>
        <Icon name="chevron-forward" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: 100 },
  rail: { width: 24, alignItems: 'center' },
  segment: { width: 2, flex: 1 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  body: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  stacked: { alignItems: 'center' },
  clock: { width: 66, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  phase: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  name: { fontSize: 16, fontWeight: '600', lineHeight: 23 },
  meta: { fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] },
});
