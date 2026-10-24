import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { useNextDepartures } from '../hooks/useTransitQueries';

export function StopDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'StopDetails'>>();
  const { stop } = route.params;
  const now = useMemo(() => new Date(), []);
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  const departures = useNextDepartures(stop.stop_id, date, time);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{stop.name}</Text>
      <Text style={styles.subtitle}>{stop.code ?? stop.stop_id}</Text>
      {departures.isFetching ? <View style={styles.skeletonRow} accessibilityLiveRegion="polite" /> : null}
      {departures.isError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          Không tải được giờ xe. Kiểm tra kết nối rồi thử lại.
        </Text>
      ) : null}
      <FlatList
        data={departures.data?.data ?? []}
        keyExtractor={(item) => `${item.trip_id}-${item.departure_time}-${item.service_date}`}
        ListEmptyComponent={<Text style={styles.muted}>{departures.isError ? 'Không tải được kết quả.' : 'Không có chuyến nào sắp chạy.'}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.route}>{item.route_short_name ?? item.route_id}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.headsign}>{item.headsign}</Text>
              <Text style={styles.time}>{item.departure_time}</Text>
            </View>
            <Text style={styles.minutes}>{item.minutes_until} phút</Text>
          </View>
        )}
      />
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => departures.refetch()} style={styles.button}>
        <Text style={styles.buttonText}>Làm mới</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  title: { color: '#102A43', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#176B87', fontWeight: '700', marginTop: 4, marginBottom: 16 },
  row: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  rowBody: { flex: 1 },
  route: { color: '#176B87', fontWeight: '800', width: 48 },
  headsign: { color: '#243B53', fontSize: 16, fontWeight: '600' },
  time: { color: '#627D98', marginTop: 2 },
  minutes: { color: '#102A43', fontWeight: '800' },
  muted: { color: '#829AB1', textAlign: 'center', marginTop: 24 },
  error: { backgroundColor: '#FFE8E6', color: '#BA1B1B', borderRadius: 12, padding: 12, marginBottom: 12 },
  skeletonRow: { height: 72, borderRadius: 12, backgroundColor: '#E4E7EB', marginBottom: 12 },
  button: { backgroundColor: '#176B87', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 14 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
