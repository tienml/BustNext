import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNearbyStops, useUnifiedSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import { Badge, Button, EmptyState, ErrorState, Icon, ListRow, LoadingState, Notice, ScreenHeader, SearchField, SectionTitle, type IconName } from '../components/ui';
import { TransitMap } from '../components/TransitMap';
import { toMapPoint, type MapPoint } from '../components/mapHtml';

type LocationStatus = {
  tone: 'info' | 'warning';
  message: string;
  /** Show an "open settings" button when the user must change a system setting. */
  action?: 'settings';
  /** Raw error code/message, shown so support can tell failures apart. */
  detail?: string;
} | null;

function errorDetail(error: unknown): string | undefined {
  if (!error) return undefined;
  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : String(error);
  return typeof code === 'string' && code ? `${code}: ${message}` : message;
}

/** Hoàn Kiếm Lake. Only used when the user explicitly picks it; always labelled as not their real location. */
const DEFAULT_CENTER = { lat: 21.0285, lon: 105.8542 };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ lat: number; lon: number }>();
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(null);
  const [usingDefault, setUsingDefault] = useState(false);
  const search = useUnifiedSearch(query);
  const nearby = useNearbyStops(position?.lat, position?.lon);

  const trimmed = query.trim();
  const searching = trimmed.length > 1;
  const stops = search.data?.data.stops ?? [];
  const routes = search.data?.data.routes ?? [];
  const nearbyStops = nearby.data?.data ?? [];

  const mapPoints = useMemo(() => {
    const points: MapPoint[] = [];
    if (position) {
      const me = toMapPoint('__me', position.lat, position.lon, 'Vị trí của bạn', 'user');
      if (me) points.push(me);
    }
    for (const stop of nearbyStops) {
      const point = toMapPoint(stop.stop_id, stop.lat, stop.lon, stop.name);
      if (point) points.push(point);
    }
    return points;
  }, [position, nearbyStops]);

  const openStopById = useCallback((stopId: string) => {
    const stop = nearbyStops.find((item) => item.stop_id === stopId);
    if (stop) navigation.navigate('StopDetails', { stop });
  }, [navigation, nearbyStops]);

  async function loadNearby() {
    setLocating(true);
    setLocationStatus({ tone: 'info', message: 'Đang lấy vị trí của bạn…' });
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext) {
        setLocationStatus({ tone: 'warning', message: 'Trình duyệt chỉ cho lấy vị trí trên https hoặc localhost. Mở app bằng http://localhost:8081 hoặc dùng vị trí mặc định bên dưới.' });
        return;
      }
      // 1. Permission: ask only when the OS still allows asking.
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        const blocked = !permission.canAskAgain && Platform.OS !== 'web';
        setLocationStatus({
          tone: 'warning',
          message: blocked
            ? 'Quyền vị trí đã bị tắt cho app. Mở Cài đặt, chọn Vị trí → Cho phép khi dùng ứng dụng, rồi thử lại.'
            : 'Bạn chưa cấp quyền vị trí. Bấm Thử lại và chọn Cho phép, hoặc dùng vị trí mặc định bên dưới.',
          action: blocked ? 'settings' : undefined,
        });
        return;
      }

      // 2. Location services (GPS / network provider).
      if (Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) {
        if (Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync();
          } catch (error) {
            console.warn('[location] enableNetworkProviderAsync failed', error);
          }
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          setLocationStatus({
            tone: 'warning',
            message: 'Dịch vụ định vị trên điện thoại đang tắt. Bật Vị trí (Location) rồi bấm Thử lại.',
            action: 'settings',
          });
          return;
        }
      }

      // 3. Coordinates: last known position first (fast), then a fresh fix.
      let found = false;
      if (Platform.OS !== 'web') {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 1000 }).catch(() => null);
        if (last) {
          setPosition({ lat: last.coords.latitude, lon: last.coords.longitude });
          setUsingDefault(false);
          setLocationStatus(null);
          found = true;
        }
      }

      let freshError: unknown;
      const fresh = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        15_000,
      ).catch((error: unknown) => {
        freshError = error;
        return null;
      });
      if (fresh) {
        setPosition({ lat: fresh.coords.latitude, lon: fresh.coords.longitude });
        setUsingDefault(false);
        setLocationStatus(null);
        return;
      }
      if (found) return;

      console.warn('[location] getCurrentPositionAsync failed', freshError);
      setLocationStatus({
        tone: 'warning',
        message: Platform.OS === 'web'
          ? 'Không lấy được vị trí. Trên Windows, kiểm tra Settings → Privacy & security → Location đã bật, hoặc dùng vị trí mặc định bên dưới.'
          : 'Không lấy được vị trí (hết thời gian chờ). Ra chỗ thoáng hoặc bật Wi‑Fi rồi thử lại. Nếu dùng Android Emulator, đặt vị trí trong Extended controls → Location.',
        detail: errorDetail(freshError),
      });
    } catch (error) {
      console.warn('[location] loadNearby failed', error);
      setLocationStatus({
        tone: 'warning',
        message: 'Không lấy được vị trí. Thử lại hoặc dùng vị trí mặc định bên dưới.',
        detail: errorDetail(error),
      });
    } finally {
      setLocating(false);
    }
  }

  function applyDefaultLocation() {
    setPosition(DEFAULT_CENTER);
    setUsingDefault(true);
    setLocationStatus({ tone: 'info', message: 'Đang hiển thị trạm quanh trung tâm Hà Nội (Hồ Gươm), không phải vị trí thật của bạn.' });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader eyebrow="BUSNEXT HÀ NỘI" title="Đi đâu hôm nay?" subtitle="Tra cứu lịch xe, trạm gần bạn và tìm đường bằng dữ liệu lịch chạy." />
      <SearchField
        accessibilityLabel="Tìm trạm hoặc tuyến"
        placeholder="Tìm trạm hoặc tuyến…"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
      />

      {searching ? (
        <View style={styles.section}>
          <SectionTitle>Kết quả tìm kiếm</SectionTitle>
          {search.isError ? <ErrorState message="Không tìm được dữ liệu. Kiểm tra kết nối rồi thử lại." onRetry={() => void search.refetch()} /> : null}
          {search.isPending && !search.isError ? <LoadingState rows={3} /> : null}
          {search.isSuccess && stops.length === 0 && routes.length === 0 ? (
            <EmptyState icon="search-outline" title="Không có kết quả" message={`Không tìm thấy trạm hoặc tuyến khớp "${trimmed}".`} />
          ) : null}
          {stops.map((stop) => (
            <ListRow
              key={`stop-${stop.stop_id}`}
              leading={<Badge icon="location" />}
              title={stop.name}
              meta={`Trạm · ${stop.code ?? stop.stop_id}`}
              accessibilityLabel={`Trạm ${stop.name}`}
              onPress={() => navigation.navigate('StopDetails', { stop })}
            />
          ))}
          {routes.map((route) => (
            <ListRow
              key={`route-${route.route_id}`}
              leading={<Badge tone="secondary" label={route.short_name ?? route.route_id} />}
              title={route.long_name ?? `Tuyến ${route.short_name ?? route.route_id}`}
              meta={route.agency_name ?? 'Tuyến xe buýt'}
              accessibilityLabel={`Tuyến ${route.short_name ?? route.route_id}`}
              onPress={() => navigation.navigate('RouteDetails', { route })}
            />
          ))}
        </View>
      ) : (
        <>
          <View style={styles.quickRow}>
            <QuickAction icon="git-compare-outline" title="Tìm đường" hint="Chọn điểm đi và đến" onPress={() => navigation.navigate('JourneyPlanner')} />
            <QuickAction icon="navigate-outline" title="Trạm gần đây" hint={locating ? 'Đang định vị…' : 'Dùng vị trí GPS'} onPress={() => void loadNearby()} disabled={locating} />
            <QuickAction icon="bus-outline" title="Tuyến xe" hint="Tra cứu theo số" onPress={() => navigation.navigate('MainTabs', { screen: 'RouteSearch' })} />
          </View>

          {locationStatus ? (
            <View style={styles.section}>
              <Notice tone={locationStatus.tone} message={locationStatus.message} />
              {locationStatus.detail ? (
                <Text style={[styles.detail, { color: colors.muted }]} selectable>Chi tiết: {locationStatus.detail}</Text>
              ) : null}
              {locationStatus.tone === 'warning' ? (
                <View style={styles.locationActions}>
                  {locationStatus.action === 'settings' ? (
                    <Button label="Mở cài đặt" icon="settings-outline" onPress={() => void Linking.openSettings()} />
                  ) : null}
                  <Button label="Thử lại" icon="refresh" variant="outline" onPress={() => void loadNearby()} />
                  <Button label="Dùng vị trí trung tâm Hà Nội" icon="map-outline" variant="ghost" onPress={applyDefaultLocation} />
                </View>
              ) : null}
            </View>
          ) : null}

          {position ? (
            <View style={styles.section}>
              <SectionTitle
                right={(
                  <Pressable accessibilityRole="button" accessibilityLabel="Cập nhật vị trí" hitSlop={10} onPress={() => void loadNearby()}>
                    <Icon name="refresh" size={20} color={colors.primary} />
                  </Pressable>
                )}
              >
                {usingDefault ? 'Trạm quanh Hồ Gươm' : 'Trạm gần bạn'}
              </SectionTitle>
              <TransitMap points={mapPoints} height={230} onSelectStop={openStopById} />
              <View style={styles.mapGap} />
              {nearby.isError ? <ErrorState message="Không tải được trạm gần đây." onRetry={() => void nearby.refetch()} /> : null}
              {nearby.isPending && !nearby.isError ? <LoadingState rows={2} /> : null}
              {nearby.isSuccess && nearbyStops.length === 0 ? (
                <EmptyState icon="location-outline" title="Không có trạm trong bán kính 1 km" message="Thử tìm trạm theo tên hoặc mã trạm." />
              ) : null}
              {nearbyStops.map((stop) => (
                <ListRow
                  key={stop.stop_id}
                  leading={<Badge icon="location" />}
                  title={stop.name}
                  meta={stop.distance_meters !== undefined ? `${Math.round(stop.distance_meters)} m · ${stop.code ?? stop.stop_id}` : stop.code ?? stop.stop_id}
                  onPress={() => navigation.navigate('StopDetails', { stop })}
                />
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <EmptyState icon="map-outline" title="Bắt đầu chuyến đi" message="Tìm trạm hoặc tuyến ở ô phía trên, hoặc bấm Trạm gần đây để xem bản đồ quanh bạn." />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function QuickAction({ icon, title, hint, onPress, disabled }: { icon: IconName; title: string; hint: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.quickCard, { backgroundColor: colors.primarySoft }, (pressed || disabled) && styles.pressed]}
    >
      <Icon name={icon} size={24} color={colors.primary} />
      <Text style={[styles.quickTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.quickHint, { color: colors.muted }]}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  section: { marginTop: spacing.lg },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickCard: { flex: 1, borderRadius: radius.lg, padding: 14, minHeight: 108 },
  quickTitle: { fontWeight: '800', marginTop: 10, fontSize: 14 },
  quickHint: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  pressed: { opacity: 0.7 },
  mapGap: { height: spacing.md },
  locationActions: { marginTop: spacing.xs, gap: spacing.xs },
  detail: { fontSize: 11, marginTop: 2, marginBottom: 4 },
});
