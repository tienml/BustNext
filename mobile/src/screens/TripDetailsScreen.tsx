import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTripDetails } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { spacing, useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteStopTimeline } from '../components/RouteStopTimeline';
import { TransitRouteBadge } from '../components/TransitRouteBadge';
import { EmptyState, ErrorState, LoadingState, ScreenHeader, SectionTitle } from '../components/ui';
import { TransitMap } from '../components/TransitMap';
import { toMapPoint, type MapPoint } from '../components/mapHtml';

export function TripDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
        contentContainerStyle={[styles.list, { paddingBottom: spacing.xl + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}
        ListHeaderComponent={
          <>
            <ScreenHeader eyebrow="LỘ TRÌNH CHUYẾN" title={title} subtitle={[routeLabel, route.params.tripId].filter(Boolean).join(' · ')} />
            {trip?.short_name || trip?.route_id ? <TransitRouteBadge label={trip.short_name ?? trip.route_id!} /> : null}
            <View style={[styles.schedule, { borderLeftColor: colors.primary, backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.scheduleTitle, { color: colors.ink }]}>Lịch dừng của chuyến</Text>
              <Text style={[styles.note, { color: colors.ink }]}>{route.params.serviceDate ? `Ngày dịch vụ ${route.params.serviceDate}` : 'Thời gian biểu · Chưa chọn ngày dịch vụ'}</Text>
              <Text style={[styles.note, { color: colors.muted }]}>Thứ tự theo stop_times · Giờ theo lịch GTFS, không phải vị trí xe trực tiếp. Giữ nguyên giờ từ 24:00 trở lên: 25:00 là 01:00 ngày sau ngày dịch vụ.</Text>
            </View>
            {details.isError ? <ErrorState message="Không tải được các điểm dừng của chuyến." onRetry={() => void details.refetch()} /> : null}
            {points.length > 0 ? <>
              <TransitMap points={points} line={line} height={240} onSelectStop={openStop} />
              <Text style={[styles.note, { color: colors.muted }]}>Đường nối các điểm dừng theo thứ tự chuyến, không phải đường đi thực tế trên phố.</Text>
            </> : null}
            <SectionTitle>{`Điểm dừng${stopTimes.length ? ` (${stopTimes.length})` : ''}`}</SectionTitle>
            {details.isLoading ? <LoadingState rows={4} height={56} /> : null}
          </>
        }
        ListEmptyComponent={
          details.isLoading || details.isError ? null : (
            <EmptyState icon="git-commit-outline" title="Chưa có điểm dừng" message="Chuyến này chưa có dữ liệu stop-times." />
          )
        }
        renderItem={({ item, index }) => (
          <RouteStopTimeline item={item} first={index === 0} last={index === stopTimes.length - 1}
            onPress={() => navigation.navigate('StopDetails', { stop: { stop_id: item.stop_id, code: item.stop_code, name: item.stop_name ?? item.stop?.name ?? item.stop_id, lat: item.lat ?? undefined, lon: item.lon ?? undefined } })} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 30, flexGrow: 1 },
  schedule: { borderLeftWidth: 3, padding: spacing.md, marginVertical: spacing.md, gap: spacing.xs },
  scheduleTitle: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 19, marginVertical: spacing.xs },
});
