import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useRouteDetails, useRouteTrips, useTripDetails } from '../hooks/useTransitQueries';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import { radius, spacing, useTheme } from '../theme';
import { getTransitDateTime } from '../utils/transitTime';
import { Badge, Button, EmptyState, ErrorState, ListRow, LoadingState, Notice, SectionTitle } from '../components/ui';
import { TransitMap } from '../components/TransitMap';
import { toMapPoint, type MapPoint } from '../components/mapHtml';

export function RouteDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'RouteDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const auth = useAuth();
  const selected = route.params.route;
  const today = useMemo(() => getTransitDateTime().date, []);
  const details = useRouteDetails(selected.route_id);
  const trips = useRouteTrips(selected.route_id, today);
  const routeData = details.data?.data ?? selected;
  const stops = useMemo(() => details.data?.stops ?? [], [details.data]);
  const tripList = trips.data?.data ?? [];
  const favorites = useFavorites();
  const routeFavorite = favorites.isFavorite('route', selected.route_id);
  const [favoriteMessage, setFavoriteMessage] = useState('');

  // The first trip of the day gives the ordered stop sequence used to draw the line.
  const firstTrip = useTripDetails(tripList[0]?.trip_id ?? '');
  const line = useMemo(() => (firstTrip.data?.stop_times ?? [])
    .map((stopTime) => [Number(stopTime.lat), Number(stopTime.lon)] as [number, number])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)), [firstTrip.data]);
  const points = useMemo(() => stops
    .map((stop) => toMapPoint(stop.stop_id, stop.lat, stop.lon, stop.name))
    .filter((point): point is MapPoint => point !== null), [stops]);

  async function toggleFavorite() {
    setFavoriteMessage('');
    if (!auth.user) {
      setFavoriteMessage('Đăng nhập ở tab Tài khoản để lưu tuyến yêu thích.');
      return;
    }
    try {
      await favorites.toggle('route', selected.route_id);
    } catch (cause) {
      setFavoriteMessage(cause instanceof Error ? cause.message : 'Không lưu được tuyến.');
    }
  }

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={[styles.routeBadge, { backgroundColor: colors.secondarySoft }]}>
          <Text style={[styles.routeCode, { color: colors.secondary }]}>{routeData.short_name ?? routeData.route_id}</Text>
        </View>
        <View style={styles.heroBody}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{routeData.long_name ?? 'Tuyến xe buýt'}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{routeData.agency_name ?? 'Dữ liệu GTFS'} · Ngày {today}</Text>
        </View>
      </View>
      <Button
        label={routeFavorite ? 'Đã lưu tuyến' : 'Lưu tuyến'}
        icon={routeFavorite ? 'heart' : 'heart-outline'}
        variant="outline"
        onPress={() => void toggleFavorite()}
      />
      {favoriteMessage ? <View style={styles.gap}><Notice message={favoriteMessage} tone="warning" /></View> : null}
      {details.isError ? <ErrorState message="Không tải được chi tiết tuyến." onRetry={() => void details.refetch()} /> : null}

      <SectionTitle>Bản đồ tuyến</SectionTitle>
      {details.isLoading ? <LoadingState rows={1} height={220} /> : points.length > 0 ? (
        <TransitMap
          points={points}
          line={line.length > 1 ? line : undefined}
          onSelectStop={(stopId) => {
            const stop = stops.find((item) => item.stop_id === stopId);
            if (stop) navigation.navigate('StopDetails', { stop });
          }}
        />
      ) : <Notice message="Dữ liệu tuyến chưa có tọa độ trạm nên không vẽ được bản đồ." />}
      {points.length > 0 ? (
        <Text style={[styles.note, { color: colors.muted }]}>
          {line.length > 1 ? 'Đường nối theo thứ tự trạm của chuyến đầu tiên trong ngày, không phải đường đi thực tế trên phố.' : 'Chạm vào một trạm trên bản đồ để xem giờ xe.'}
        </Text>
      ) : null}

      <SectionTitle>{`Chuyến trong ngày (${tripList.length})`}</SectionTitle>
      {trips.isLoading ? <LoadingState rows={3} /> : null}
      {trips.isError ? <ErrorState message="Không tải được danh sách chuyến." onRetry={() => void trips.refetch()} /> : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={tripList}
      keyExtractor={(item) => item.trip_id}
      ListHeaderComponent={header}
      ListEmptyComponent={trips.isLoading || trips.isError ? null : (
        <EmptyState icon="calendar-outline" title="Không có chuyến hôm nay" message="Tuyến này không chạy vào ngày đã chọn theo lịch GTFS." />
      )}
      renderItem={({ item }) => {
        const headsign = item.headsign ?? item.trip_headsign ?? undefined;
        return (
          <ListRow
            leading={<Badge icon="time-outline" />}
            title={item.departure_time ? `${item.departure_time.slice(0, 5)} · ${headsign ?? 'Chuyến theo lịch'}` : headsign ?? 'Chuyến theo lịch'}
            meta={item.trip_id}
            accessibilityLabel={`Chuyến ${headsign ?? item.trip_id}${item.departure_time ? `, xuất phát ${item.departure_time.slice(0, 5)}` : ''}`}
            onPress={() => navigation.navigate('TripDetails', { tripId: item.trip_id, title: headsign })}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  hero: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  routeBadge: { borderRadius: radius.md, minWidth: 64, minHeight: 56, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  routeCode: { fontWeight: '800', fontSize: 20 },
  heroBody: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { marginTop: 5, fontSize: 12 },
  gap: { marginTop: spacing.sm },
  note: { fontSize: 12, lineHeight: 18, marginTop: 8 },
});
