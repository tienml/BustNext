import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTripDetails } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';
import { formatGtfsTime } from '../utils/transitTime';

export function TripDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetails'>>();
  const details = useTripDetails(route.params.tripId);
  const stopTimes = useMemo(() => [...(details.data?.stop_times ?? [])].sort((a, b) => a.stop_sequence - b.stop_sequence), [details.data?.stop_times]);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TIMELINE CHUYẾN</Text>
      <Text style={styles.title}>{route.params.title ?? details.data?.data.trip_headsign ?? 'Chi tiết chuyến'}</Text>
      <Text style={styles.subtitle}>{route.params.tripId}</Text>
      {details.isFetching ? <View style={styles.skeletonRow} accessibilityLiveRegion="polite" /> : null}
      {details.isError ? <Text style={styles.error} accessibilityLiveRegion="polite">Không tải được các điểm dừng của chuyến.</Text> : null}
      <FlatList
        data={stopTimes}
        keyExtractor={(item, index) => `${item.stop_id}-${item.stop_sequence}-${index}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>Chưa có dữ liệu stop-times cho chuyến này.</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.timelineRow}>
            <View style={styles.markerColumn}>
              <View style={[styles.dot, index === 0 && styles.firstDot]} />
              {index < stopTimes.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.stopBody}>
              <Text style={styles.sequence}>{String(item.stop_sequence).padStart(2, '0')}</Text>
              <Text style={styles.stopName}>{item.stop?.name ?? item.stop_id}</Text>
              <Text style={styles.time}>{formatGtfsTime(item.departure_time ?? item.arrival_time)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, marginTop: 4, marginBottom: 18 },
  list: { paddingBottom: 24 },
  timelineRow: { flexDirection: 'row', minHeight: 70 },
  markerColumn: { width: 26, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#A9B4C2', marginTop: 4, zIndex: 1 },
  firstDot: { backgroundColor: colors.primary, width: 16, height: 16, borderRadius: 8 },
  line: { position: 'absolute', top: 14, bottom: 0, width: 2, backgroundColor: '#D5DCE5' },
  stopBody: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, flex: 1, marginLeft: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  sequence: { color: colors.primary, fontSize: 12, fontWeight: '800', width: 28 },
  stopName: { color: colors.ink, fontWeight: '700', flex: 1 },
  time: { color: colors.muted, fontSize: 12, marginLeft: 8 },
  muted: { color: colors.muted, textAlign: 'center', marginTop: 28 },
  error: { backgroundColor: colors.dangerSurface, color: colors.danger, borderRadius: 12, padding: 12, marginBottom: 12 },
  skeletonRow: { height: 74, borderRadius: 14, backgroundColor: '#E6E8F0', marginBottom: 12 },
});
