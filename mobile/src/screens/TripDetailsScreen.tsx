import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTripDetails } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import { formatGtfsTime } from '../utils/transitTime';
import { EmptyState, ErrorState, LoadingState, ScreenHeader, SectionTitle } from '../components/ui';
import { TransitMap } from '../components/TransitMap';
import { toMapPoint, type MapPoint } from '../components/mapHtml';

export function TripDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const details = useTripDetails(route.params.tripId);
  const trip = details.data?.data;
  const stopTimes = useMemo(
    () => [...(details.data?.stop_times ?? [])].sort((a, b) => a.stop_sequence - b.stop_sequence),
    [details.data?.stop_times],
  );

  const points = useMemo(
    () => stopTimes
      .map((item) => toMapPoint(item.stop_id, item.lat, item.lon, item.stop_name ?? item.stop?.name ?? item.stop_id))
      .filter((point): point is MapPoint => point !== null),
    [stopTimes],
  );
  const line = useMemo(() => points.map((point) => [point.lat, point.lon] as [number, number]), [points]);

  const title = route.params.title ?? trip?.headsign ?? trip?.trip_headsign ?? 'Chi tiết chuyến';
  const routeLabel = trip?.short_name ? `Tuyến ${trip.short_name}` : undefined;

  function openStop(stopId: string) {
    const item = stopTimes.find((entry) => entry.stop_id === stopId);
    if (!item) return;
    navigation.navigate('StopDetails', {
      stop: { stop_id: item.stop_id, code: item.stop_code, name: item.stop_name ?? item.stop_id, lat: item.lat ?? undefined, lon: item.lon ?? undefined },
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={stopTimes}
        keyExtractor={(item, index) => `${item.stop_id}-${item.stop_sequence}-${index}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <ScreenHeader eyebrow="LỘ TRÌNH CHUYẾN" title={title} subtitle={[routeLabel, route.params.tripId].filter(Boolean).join(' · ')} />
            {details.isError ? <ErrorState message="Không tải được các điểm dừng của chuyến." onRetry={() => void details.refetch()} /> : null}
            {points.length > 0 ? <TransitMap points={points} line={line} height={240} onSelectStop={openStop} /> : null}
            <SectionTitle>{`Điểm dừng${stopTimes.length ? ` (${stopTimes.length})` : ''}`}</SectionTitle>
            {details.isLoading ? <LoadingState rows={4} height={56} /> : null}
          </>
        }
        ListEmptyComponent={
          details.isLoading || details.isError ? null : (
            <EmptyState icon="git-commit-outline" title="Chưa có điểm dừng" message="Chuyến này chưa có dữ liệu stop-times." />
          )
        }
        renderItem={({ item, index }) => {
          const first = index === 0;
          const last = index === stopTimes.length - 1;
          return (
            <View style={styles.row}>
              <View style={styles.marker}>
                <View style={[styles.segment, { backgroundColor: first ? 'transparent' : colors.primary }]} />
                <View style={[styles.dot, { borderColor: colors.primary, backgroundColor: first || last ? colors.primary : colors.surface }]} />
                <View style={[styles.segment, { backgroundColor: last ? 'transparent' : colors.primary }]} />
              </View>
              <View style={[styles.body, { borderBottomColor: colors.border }]}>
                <View style={styles.bodyText}>
                  <Text style={[styles.stopName, { color: colors.ink }]} numberOfLines={2}>{item.stop_name ?? item.stop?.name ?? item.stop_id}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>{`#${item.stop_sequence} · ${item.stop_code ?? item.stop_id}`}</Text>
                </View>
                <Text style={[styles.time, { color: first || last ? colors.primary : colors.ink }]}>
                  {formatGtfsTime(item.departure_time ?? item.arrival_time)}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 30, flexGrow: 1 },
  row: { flexDirection: 'row', minHeight: 60 },
  marker: { width: 28, alignItems: 'center' },
  segment: { width: 3, flex: 1 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
  bodyText: { flex: 1, paddingRight: 8 },
  stopName: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 3 },
  time: { fontSize: 15, fontWeight: '800' },
});
