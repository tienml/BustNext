import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useRouteDetails, useRouteTrips, useTripDetails } from '../hooks/useTransitQueries';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import { radius, spacing, useTheme } from '../theme';
import { formatGtfsTime, getTransitDateTime, isTransitDate } from '../utils/transitTime';
import { TransitRouteBadge } from '../components/TransitRouteBadge';
import { TransitSignRow } from '../components/TransitSignRow';
import { Button, EmptyState, ErrorState, LoadingState, Notice, SearchField, SectionTitle } from '../components/ui';
import { TransitMap } from '../components/TransitMap';
import { toMapPoint, type MapPoint } from '../components/mapHtml';

export function RouteDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'RouteDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const selected = route.params.route;
  const [today, setToday] = useState(() => getTransitDateTime().date);
  const [dateInput, setDateInput] = useState(today);
  const [dateError, setDateError] = useState('');
  const [tripSearch, setTripSearch] = useState('');
  const details = useRouteDetails(selected.route_id);
  const trips = useRouteTrips(selected.route_id, today);
  const routeData = details.data?.data ?? selected;
  const stops = useMemo(() => details.data?.stops ?? [], [details.data]);
  const tripList = trips.data?.data ?? [];
  // This endpoint returns all trips for this route/service date, without pagination.
  const filteredTrips = tripList.filter((trip) => [trip.trip_id, trip.headsign, trip.trip_headsign]
    .some((value) => value?.toLocaleLowerCase('vi').includes(tripSearch.trim().toLocaleLowerCase('vi'))));
  const favorites = useFavorites();
  const routeFavorite = favorites.isFavorite('route', selected.route_id);
  const [favoriteMessage, setFavoriteMessage] = useState('');

  function applyDate() {
    if (!isTransitDate(dateInput)) { setDateError('Nhập ngày hợp lệ dạng YYYY-MM-DD.'); return; }
    setDateError(''); setToday(dateInput);
    if (dateInput === today) void trips.refetch();
  }

  function stepDate(days: number) {
    const base = isTransitDate(dateInput) ? dateInput : today;
    const next = new Date(`${base}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    const value = next.toISOString().slice(0, 10);
    if (isTransitDate(value)) { setDateInput(value); setDateError(''); }
  }

  // The first trip of the day gives the ordered stop sequence used to draw the line.
  const firstTrip = useTripDetails(tripList[0]?.trip_id ?? '');
  const line = useMemo(() => [...(firstTrip.data?.stop_times ?? [])]
    .sort((a, b) => a.stop_sequence - b.stop_sequence)
    .map((stopTime) => toMapPoint(stopTime.stop_id, stopTime.lat, stopTime.lon, stopTime.stop_name ?? stopTime.stop_id))
    .filter((point): point is MapPoint => point !== null)
    .map((point) => [point.lat, point.lon] as [number, number]), [firstTrip.data]);
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
        <TransitRouteBadge label={routeData.short_name ?? routeData.route_id} />
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

      <SectionTitle>Các trạm thuộc tuyến</SectionTitle>
      <Text style={[styles.note, { color: colors.muted }]}>{details.isSuccess ? `${stops.length} trạm trong dữ liệu tuyến. ` : ''}Đây là tập hợp trạm của các chuyến, không phải thứ tự một hành trình. Chọn chuyến bên dưới để xem đúng thứ tự dừng.</Text>
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
          {line.length > 1 ? `Đường nối minh họa riêng chuyến ${tripList[0]?.trip_id}, ngày dịch vụ ${today}; không đại diện mọi chiều tuyến và không phải đường đi thực tế trên phố.` : 'Chạm vào một trạm trên bản đồ để xem giờ xe. Chưa có đường nối chuyến minh họa.'}
        </Text>
      ) : null}

      <SectionTitle>Tra cứu chuyến trong tuyến</SectionTitle>
      <View style={[styles.filters, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Text style={{ color: colors.ink }}>Ngày dịch vụ (YYYY-MM-DD)</Text>
        <SearchField icon="calendar-outline" accessibilityLabel="Ngày dịch vụ, năm-tháng-ngày" value={dateInput} onChangeText={setDateInput} maxLength={10} autoCorrect={false} autoCapitalize="none" onSubmitEditing={applyDate} />
        {dateError ? <ErrorState message={dateError} /> : null}
        <View style={styles.shortcuts}>
          <Button label="Ngày trước" variant="ghost" onPress={() => stepDate(-1)} />
          <Button label="Hôm nay" variant="ghost" onPress={() => { setDateInput(getTransitDateTime().date); setDateError(''); }} />
          <Button label="Ngày sau" variant="ghost" onPress={() => stepDate(1)} />
        </View>
        {dateInput !== today ? <Text accessibilityLiveRegion="polite" style={{ color: colors.warning }}>Ngày chưa áp dụng. Danh sách vẫn theo ngày {today}.</Text> : null}
        <Button label="Xem chuyến theo ngày" variant="outline" onPress={applyDate} disabled={dateInput === today && trips.isFetching} />
        <Text style={{ color: colors.ink }}>Mã chuyến hoặc hướng đến</Text>
        <SearchField accessibilityLabel="Tìm mã chuyến hoặc hướng đến trong tuyến" placeholder="Mã chuyến hoặc hướng đến" value={tripSearch} onChangeText={setTripSearch} autoCorrect={false} />
        <Text style={[styles.note, { color: colors.muted }]}>Lọc toàn bộ chuyến của tuyến này trong ngày dịch vụ {today}, không tìm chuyến toàn mạng.</Text>
      </View>
      <SectionTitle>{`Chuyến trong ngày (${filteredTrips.length}/${tripList.length})`}</SectionTitle>
      {trips.isFetching && !trips.isLoading ? <Text accessibilityLiveRegion="polite" style={[styles.note, { color: colors.muted }]}>Đang cập nhật chuyến…</Text> : null}
      {trips.isLoading ? <LoadingState rows={3} /> : null}
      {trips.isError ? <ErrorState message="Không tải được danh sách chuyến." onRetry={() => void trips.refetch()} /> : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.list, { paddingBottom: spacing.lg + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}
      keyboardShouldPersistTaps="handled"
      data={filteredTrips}
      keyExtractor={(item) => item.trip_id}
      ListHeaderComponent={header}
      ListEmptyComponent={trips.isLoading || trips.isError ? null : (
        <EmptyState icon="calendar-outline" title="Không có chuyến phù hợp" message="Không có chuyến khớp từ khóa trong ngày dịch vụ đã chọn. Hãy thử ngày hoặc từ khóa khác." />
      )}
      renderItem={({ item }) => {
        const headsign = item.headsign ?? item.trip_headsign ?? undefined;
        return (
          <TransitSignRow
            code={routeData.short_name ?? routeData.route_id}
            title={headsign ?? 'Chuyến theo lịch'}
            meta={[item.departure_time ? `Khởi hành ${formatGtfsTime(item.departure_time)}` : 'Chưa có giờ khởi hành', `Ngày dịch vụ ${today}`, item.trip_id].join(' · ')}
            label={`Chuyến ${headsign ?? item.trip_id}, ngày dịch vụ ${today}${item.departure_time ? `, xuất phát ${formatGtfsTime(item.departure_time)}` : ''}`}
            onPress={() => navigation.navigate('TripDetails', { tripId: item.trip_id, title: headsign, serviceDate: today })}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  heroBody: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { marginTop: 5, fontSize: 12 },
  gap: { marginTop: spacing.sm },
  filters: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { fontSize: 12, lineHeight: 18, marginTop: 8 },
});
