import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useRouteDetails, useRouteTrips } from '../hooks/useTransitQueries';
import { useFavorites } from '../hooks/useFavorites';
import { colors, spacing } from '../theme';
import { getTransitDateTime } from '../utils/transitTime';

export function RouteDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'RouteDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const selected = route.params.route;
  const today = useMemo(() => getTransitDateTime().date, []);
  const details = useRouteDetails(selected.route_id);
  const trips = useRouteTrips(selected.route_id, today);
  const routeData = details.data?.data ?? selected;
  const stops = details.data?.stops ?? [];
  const favorites = useFavorites();
  const routeFavorite = favorites.isFavorite('route', selected.route_id);

  async function toggleFavorite() {
    try {
      await favorites.toggle('route', selected.route_id);
    } catch {
      // The account tab explains that sign-in is required when no token exists.
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>CHI TIẾT TUYẾN</Text>
      <View style={styles.hero}>
        <View style={styles.routeBadge}><Text style={styles.routeCode}>{routeData.short_name ?? routeData.route_id}</Text></View>
        <View style={styles.heroBody}>
          <Text style={styles.title}>{routeData.long_name ?? 'Tuyến xe buýt'}</Text>
          <Text style={styles.subtitle}>{routeData.agency_name ?? 'Dữ liệu GTFS'} · Ngày {today}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={routeFavorite ? 'Bỏ lưu tuyến' : 'Lưu tuyến'} onPress={() => void toggleFavorite()} style={styles.favoriteButton}>
            <Text style={styles.favoriteText}>{routeFavorite ? '★ Đã lưu' : '☆ Lưu tuyến'}</Text>
          </Pressable>
        </View>
      </View>
      {details.isError ? <Text style={styles.error} accessibilityLiveRegion="polite">Không tải được chi tiết tuyến.</Text> : null}
      <Text style={styles.sectionTitle}>Các trạm trong dữ liệu tuyến</Text>
      <Text style={styles.note}>Danh sách này không phải thứ tự di chuyển. Chọn một chuyến để xem timeline chính xác.</Text>
      <FlatList
        data={stops}
        keyExtractor={(item) => item.stop_id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stopList}
        ListEmptyComponent={<Text style={styles.muted}>Chưa có danh sách trạm.</Text>}
        renderItem={({ item }) => <View style={styles.stopChip}><Text style={styles.stopText}>{item.name}</Text></View>}
      />
      <Text style={styles.sectionTitle}>Chuyến trong ngày</Text>
      {trips.isFetching ? <View style={styles.skeletonRow} accessibilityLiveRegion="polite" /> : null}
      {trips.isError ? <Text style={styles.error} accessibilityLiveRegion="polite">Không tải được danh sách chuyến.</Text> : null}
      <FlatList
        data={trips.data?.data ?? []}
        keyExtractor={(item) => item.trip_id}
        contentContainerStyle={styles.tripList}
        ListEmptyComponent={<Text style={styles.muted}>Không có chuyến trong ngày đã chọn.</Text>}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.tripRow, pressed && styles.pressed]} onPress={() => navigation.navigate('TripDetails', { tripId: item.trip_id, title: item.trip_headsign })} accessibilityRole="button" accessibilityLabel={`Chuyến ${item.trip_id}`}>
            <View style={styles.tripIcon}><Text style={styles.tripIconText}>→</Text></View>
            <View style={styles.tripBody}>
              <Text style={styles.tripTitle}>{item.trip_headsign ?? 'Chuyến theo lịch'}</Text>
              <Text style={styles.tripMeta}>{item.trip_id} · {item.departure_time ?? 'Chưa có giờ xuất phát'}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  eyebrow: { color: colors.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  hero: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 20 },
  routeBadge: { backgroundColor: '#E5EBFF', borderRadius: 14, minWidth: 62, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  routeCode: { color: colors.secondary, fontWeight: '800', fontSize: 19 },
  heroBody: { flex: 1 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, marginTop: 5, fontSize: 12 },
  favoriteButton: { alignSelf: 'flex-start', borderColor: '#0051D5', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  favoriteText: { color: '#0051D5', fontWeight: '800' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 6 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  stopList: { paddingBottom: 14 },
  stopChip: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8, maxWidth: 180 },
  stopText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  tripList: { paddingTop: 4, paddingBottom: 24 },
  tripRow: { backgroundColor: colors.surface, borderRadius: 15, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', minHeight: 68, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 7, elevation: 2 },
  pressed: { opacity: 0.72 },
  tripIcon: { backgroundColor: colors.primarySoft, borderRadius: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tripIconText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  tripBody: { flex: 1 },
  tripTitle: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  tripMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.secondary, fontSize: 28, lineHeight: 28 },
  muted: { color: colors.muted, marginVertical: 14 },
  error: { backgroundColor: colors.dangerSurface, color: colors.danger, borderRadius: 12, padding: 12, marginBottom: 10 },
  skeletonRow: { height: 68, borderRadius: 15, backgroundColor: '#E6E8F0', marginBottom: 12 },
});
