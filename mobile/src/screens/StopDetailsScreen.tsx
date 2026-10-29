import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useNextDepartures, useStopDetails } from '../hooks/useTransitQueries';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import { formatGtfsTime, getTransitDateTime } from '../utils/transitTime';
import { Badge, Button, EmptyState, ErrorState, Icon, ListRow, LoadingState, Notice, ScreenHeader, SectionTitle } from '../components/ui';
import { TransitMap } from '../components/TransitMap';
import { toMapPoint } from '../components/mapHtml';
import { spacing, useTheme } from '../theme';

export function StopDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'StopDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { stop } = route.params;
  const { colors } = useTheme();
  const auth = useAuth();
  const [now, setNow] = useState(() => getTransitDateTime());
  const details = useStopDetails(stop.stop_id);
  const departures = useNextDepartures(stop.stop_id, now.date, now.time);
  const currentStop = details.data?.data ?? stop;
  const favorites = useFavorites();
  const saved = favorites.isFavorite('stop', stop.stop_id);
  const [favoriteError, setFavoriteError] = useState('');

  const points = useMemo(() => {
    const point = toMapPoint(currentStop.stop_id, currentStop.lat, currentStop.lon, currentStop.name);
    return point ? [point] : [];
  }, [currentStop.stop_id, currentStop.lat, currentStop.lon, currentStop.name]);

  async function toggleFavorite() {
    setFavoriteError('');
    try {
      await favorites.toggle('stop', stop.stop_id);
    } catch (cause) {
      setFavoriteError(cause instanceof Error ? cause.message : 'Không lưu được trạm.');
    }
  }

  const favoriteButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Bỏ lưu trạm' : 'Lưu trạm'}
      hitSlop={10}
      onPress={() => (auth.user ? void toggleFavorite() : navigation.navigate('MainTabs', { screen: 'Account' }))}
      style={[styles.favorite, { backgroundColor: colors.primarySoft }]}
    >
      <Icon name={saved ? 'heart' : 'heart-outline'} size={22} color={colors.primary} />
    </Pressable>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={departures.data?.data ?? []}
      keyExtractor={(item) => `${item.trip_id}-${item.departure_time}-${item.service_date}`}
      ListHeaderComponent={
        <>
          <ScreenHeader eyebrow="TRẠM XE BUÝT" title={currentStop.name} subtitle={currentStop.code ?? currentStop.stop_id} right={favoriteButton} />
          {!auth.user ? <Notice message="Đăng nhập ở tab Tài khoản để lưu trạm yêu thích." icon="person-circle-outline" /> : null}
          {favoriteError ? <ErrorState message={favoriteError} /> : null}
          {details.isError ? <Notice tone="warning" message="Không tải được thông tin mới nhất của trạm. Đang hiển thị dữ liệu tìm kiếm." /> : null}
          {points.length > 0 ? <TransitMap points={points} height={180} /> : null}
          <SectionTitle right={<Text style={[styles.updated, { color: colors.muted }]}>Cập nhật {now.time.slice(0, 5)}</Text>}>Chuyến sắp chạy</SectionTitle>
          {departures.isError ? <ErrorState message="Không tải được giờ xe. Kiểm tra kết nối rồi thử lại." onRetry={() => void departures.refetch()} /> : null}
          {departures.isLoading ? <LoadingState rows={3} /> : null}
        </>
      }
      ListEmptyComponent={
        departures.isLoading || departures.isError ? null : (
          <EmptyState icon="time-outline" title="Không có chuyến sắp chạy" message="Theo lịch GTFS, trạm này không còn chuyến nào trong ngày." />
        )
      }
      renderItem={({ item }) => (
        <ListRow
          leading={<Badge label={item.route_short_name ?? item.route_id} />}
          title={item.headsign ?? 'Chưa có hướng tuyến'}
          meta={`${formatGtfsTime(item.departure_time)} · ngày dịch vụ ${item.service_date}`}
          trailing={<Text style={[styles.minutes, { color: colors.primary }]}>{item.minutes_until <= 0 ? 'Sắp đến' : `${item.minutes_until} phút`}</Text>}
          onPress={() => navigation.navigate('TripDetails', { tripId: item.trip_id, title: item.headsign ?? undefined })}
          accessibilityLabel={`Tuyến ${item.route_short_name ?? item.route_id}, ${item.minutes_until} phút nữa`}
        />
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          <Button label="Làm mới giờ xe" icon="refresh" variant="outline" loading={departures.isFetching && !departures.isLoading} onPress={() => setNow(getTransitDateTime())} />
          <Text style={[styles.note, { color: colors.muted }]}>Giờ xe theo lịch tĩnh, chưa phải vị trí xe thời gian thực.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: 32 },
  favorite: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  updated: { fontSize: 12, fontWeight: '600' },
  minutes: { fontWeight: '800', fontSize: 14, marginLeft: 8 },
  footer: { marginTop: spacing.sm },
  note: { fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});
