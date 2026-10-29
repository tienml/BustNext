import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { useNextDepartures, useStopDetails } from '../hooks/useTransitQueries';
import { useFavorites } from '../hooks/useFavorites';
import { formatGtfsTime, getTransitDateTime } from '../utils/transitTime';

export function StopDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'StopDetails'>>();
  const { stop } = route.params;
  const now = useMemo(() => getTransitDateTime(), []);
  const details = useStopDetails(stop.stop_id);
  const departures = useNextDepartures(stop.stop_id, now.date, now.time);
  const currentStop = details.data?.data ?? stop;
  const favorites = useFavorites();
  const stopFavorite = favorites.isFavorite('stop', stop.stop_id);

  async function toggleFavorite() {
    try {
      await favorites.toggle('stop', stop.stop_id);
    } catch {
      // The account tab explains that sign-in is required when no token exists.
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TRẠM XE BUÝT</Text>
      <Text style={styles.title}>{currentStop.name}</Text>
      <Text style={styles.subtitle}>{currentStop.code ?? currentStop.stop_id}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={stopFavorite ? 'Bỏ lưu trạm' : 'Lưu trạm'} onPress={() => void toggleFavorite()} style={styles.favoriteButton}>
        <Text style={styles.favoriteText}>{stopFavorite ? '★ Đã lưu' : '☆ Lưu trạm'}</Text>
      </Pressable>
      {currentStop.lat !== undefined && currentStop.lon !== undefined ? (
        <Text style={styles.coordinates}>{`${currentStop.lat}, ${currentStop.lon}`}</Text>
      ) : null}
      {details.isError ? (
        <Text accessibilityLiveRegion="polite" style={styles.warning}>
          Không tải được thông tin mới nhất của trạm. Đang hiển thị dữ liệu tìm kiếm.
        </Text>
      ) : null}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Chuyến sắp chạy</Text>
        <Text style={styles.liveLabel}>LỊCH API</Text>
      </View>
      {departures.isFetching ? <View style={styles.skeletonRow} accessibilityLiveRegion="polite" /> : null}
      {departures.isError ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>Không tải được giờ xe. Kiểm tra kết nối rồi thử lại.</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => departures.refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={departures.data?.data ?? []}
        keyExtractor={(item) => `${item.trip_id}-${item.departure_time}-${item.service_date}`}
        ListEmptyComponent={
          departures.isFetching ? null : <Text style={styles.muted}>Không có chuyến nào sắp chạy.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.routeBadge}>
              <Text style={styles.route}>{item.route_short_name ?? item.route_id}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.headsign}>{item.headsign ?? 'Chưa có hướng tuyến'}</Text>
              <Text style={styles.time}>{formatGtfsTime(item.departure_time)} · {item.service_date}</Text>
            </View>
            <Text style={styles.minutes}>{item.minutes_until} phút</Text>
          </View>
        )}
      />
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => departures.refetch()} style={styles.button}>
        <Text style={styles.buttonText}>Làm mới giờ xe</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8FF', padding: 20 },
  eyebrow: { color: '#006948', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#131B2E', fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#006948', fontWeight: '700', marginTop: 4 },
  favoriteButton: { alignSelf: 'flex-start', borderColor: '#006948', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  favoriteText: { color: '#006948', fontWeight: '800' },
  coordinates: { color: '#657080', fontSize: 12, marginTop: 4, marginBottom: 14 },
  warning: { backgroundColor: '#FFF3D6', color: '#7A4C00', borderRadius: 12, padding: 12, marginTop: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: '#131B2E', fontSize: 18, fontWeight: '800' },
  liveLabel: { color: '#006948', fontSize: 11, fontWeight: '800' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#131B2E', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  routeBadge: { backgroundColor: '#D5F5E4', borderRadius: 10, minWidth: 48, minHeight: 42, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  route: { color: '#006948', fontWeight: '800' },
  rowBody: { flex: 1 },
  headsign: { color: '#131B2E', fontSize: 15, fontWeight: '700' },
  time: { color: '#657080', marginTop: 4, fontSize: 12 },
  minutes: { color: '#131B2E', fontWeight: '800', marginLeft: 8 },
  muted: { color: '#657080', textAlign: 'center', marginTop: 24 },
  errorBox: { backgroundColor: '#FFE8E6', borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { color: '#BA1B1B', marginBottom: 8 },
  retryButton: { alignSelf: 'flex-start', backgroundColor: '#BA1B1B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  skeletonRow: { height: 72, borderRadius: 16, backgroundColor: '#E6E8F0', marginBottom: 12 },
  button: { backgroundColor: '#006948', borderRadius: 14, minHeight: 48, padding: 14, alignItems: 'center', marginTop: 14 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
});
