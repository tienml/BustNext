import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNearbyStops, useUnifiedSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import { Badge, Button, ErrorState, Icon, ListRow, LoadingState, Notice, SearchField, SectionTitle, type IconName } from '../components/ui';
import { TransitMap } from '../components/TransitMap';
import { TransitEmptyState, TransitIllustration } from '../components/TransitIllustration';
import { toMapPoint, type MapPoint } from '../components/mapHtml';
import { acquireLocation, CACHE_MAX_ACCURACY_M, CACHE_MAX_AGE_MS, describeLocation, isUsableLocation } from '../utils/deviceLocation';

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

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const spaciousHeader = width >= 360 && fontScale < 1.4;
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ lat: number; lon: number }>();
  const [locating, setLocating] = useState(false);
  const locationRequestInFlight = useRef(false);
  const activeLocationRequest = useRef<AbortController | null>(null);
  const [locationInfo, setLocationInfo] = useState<string>();
  useEffect(() => () => {
    activeLocationRequest.current?.abort();
    activeLocationRequest.current = null;
    locationRequestInFlight.current = false;
  }, []);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(null);
  const [usingDefault, setUsingDefault] = useState(false);
  const search = useUnifiedSearch(query);
  const nearby = useNearbyStops(position?.lat, position?.lon);

  const trimmed = query.trim();
  const searching = trimmed.length > 1;
  const stops = search.data?.data.stops ?? [];
  const routes = search.data?.data.routes ?? [];
  const trips = search.data?.data.trips ?? [];
  const nearbyStops = nearby.data?.data ?? [];

  const mapPoints = useMemo(() => {
    const points: MapPoint[] = [];
    if (position) {
      const me = toMapPoint('__me', position.lat, position.lon, usingDefault ? 'Trung tâm Hà Nội (vị trí mẫu)' : 'Vị trí thiết bị (ước tính)', 'user');
      if (me) points.push(me);
    }
    for (const stop of nearbyStops) {
      const point = toMapPoint(stop.stop_id, stop.lat, stop.lon, stop.name);
      if (point) points.push(point);
    }
    return points;
  }, [position, nearbyStops, usingDefault]);

  const openStopById = useCallback((stopId: string) => {
    const stop = nearbyStops.find((item) => item.stop_id === stopId);
    if (stop) navigation.navigate('StopDetails', { stop });
  }, [navigation, nearbyStops]);

  async function loadNearby() {
    if (locationRequestInFlight.current) return;
    locationRequestInFlight.current = true;
    const controller = new AbortController();
    activeLocationRequest.current = controller;
    const isCurrent = () => activeLocationRequest.current === controller && !controller.signal.aborted;
    setLocating(true);
    setLocationStatus({ tone: 'info', message: 'Đang lấy vị trí của bạn…' });
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext) {
        setLocationStatus({ tone: 'warning', message: 'Trình duyệt chỉ cho lấy vị trí trên https hoặc localhost. Mở app bằng http://localhost:8081 hoặc dùng vị trí mặc định bên dưới.' });
        return;
      }
      // Browser permissions are requested by the cancellable browser watch below.
      if (Platform.OS !== 'web') {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!isCurrent()) return;
      if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!isCurrent()) return;
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        const blocked = !permission.canAskAgain;
        setLocationStatus({
          tone: 'warning',
          message: blocked
            ? 'Quyền vị trí đã bị tắt cho app. Mở Cài đặt, chọn Vị trí → Cho phép khi dùng ứng dụng, rồi thử lại.'
            : 'Bạn chưa cấp quyền vị trí. Bấm Thử lại và chọn Cho phép, hoặc dùng vị trí mặc định bên dưới.',
          action: blocked ? 'settings' : undefined,
        });
        return;
      }

      // Only reached after the user presses the location button; never open settings automatically.
      if (Platform.OS === 'android') {
        const provider = await Location.getProviderStatusAsync();
        if (!isCurrent()) return;
        if (!provider.locationServicesEnabled || !provider.networkAvailable) {
          try {
            await Location.enableNetworkProviderAsync();
          } catch {
            // The user can decline network assistance; GPS may still work.
          }
        }
      }
      if (!isCurrent()) return;
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isCurrent()) return;
      if (!servicesEnabled) {
        setLocationStatus({ tone: 'warning', message: 'Dịch vụ định vị trên điện thoại đang tắt. Bật Vị trí (Location) rồi bấm Thử lại.', action: 'settings' });
        return;
      }
      }

      // Render validated cached coordinates promptly without calling them a fresh fix.
      if (Platform.OS !== 'web') {
        void Location.getLastKnownPositionAsync({ maxAge: CACHE_MAX_AGE_MS, requiredAccuracy: CACHE_MAX_ACCURACY_M })
          .then((last) => {
            if (!isCurrent() || !last || !isUsableLocation(last)) return;
            setPosition({ lat: last.coords.latitude, lon: last.coords.longitude });
            setUsingDefault(false);
            setLocationInfo(describeLocation(last, true));
          }).catch(() => { /* A missing cache must not prevent a live fix. */ });
      }

      const fresh = await acquireLocation((onLocation, onError) => {
        if (Platform.OS === 'web') {
          // Expo SDK 52's web watcher drops the error callback. Use the browser
          // watch directly so permission failures and clearWatch work reliably.
          if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return Promise.reject(new Error('Trình duyệt không hỗ trợ định vị.'));
          }
          const id = navigator.geolocation.watchPosition(
            (fix) => onLocation({ coords: { ...fix.coords, latitude: fix.coords.latitude, longitude: fix.coords.longitude,
              accuracy: fix.coords.accuracy, altitude: fix.coords.altitude, altitudeAccuracy: fix.coords.altitudeAccuracy,
              heading: fix.coords.heading, speed: fix.coords.speed }, timestamp: fix.timestamp }),
            (error) => onError(new Error(`${error.code}: ${error.message}`)),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 },
          );
          return Promise.resolve({ remove: () => navigator.geolocation.clearWatch(id) });
        }
        return Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: false },
          onLocation, onError,
        );
      }, controller.signal);
      if (!isCurrent()) return;
      setPosition({ lat: fresh.coords.latitude, lon: fresh.coords.longitude });
      setUsingDefault(false);
      setLocationInfo(describeLocation(fresh, false));
      setLocationStatus(null);
    } catch (error) {
      if (!isCurrent()) return;
      setLocationStatus({
        tone: 'warning',
        message: Platform.OS === 'web'
          ? 'Chưa lấy được vị trí mới. Cho phép Vị trí trong trình duyệt và bật định vị của thiết bị rồi thử lại. Web trên máy tính lấy vị trí máy tính, không phải điện thoại. Nếu có vị trí cũ bên dưới, vị trí đó chưa được cập nhật.'
          : 'Chưa lấy được vị trí mới trong lần thử này. Bật Vị trí và Wi-Fi, cho phép vị trí chính xác, ra chỗ thoáng rồi thử lại. Nếu có vị trí cũ bên dưới, vị trí đó chưa được cập nhật. Giả lập chỉ dùng vị trí mô phỏng, không đọc GPS điện thoại.',
        detail: errorDetail(error),
      });
    } finally {
      if (activeLocationRequest.current === controller) {
        activeLocationRequest.current = null;
        locationRequestInFlight.current = false;
        setLocating(false);
      }
    }
  }

  function applyDefaultLocation() {
    activeLocationRequest.current?.abort();
    activeLocationRequest.current = null;
    locationRequestInFlight.current = false;
    setLocating(false);
    setLocationInfo(undefined);
    setPosition(DEFAULT_CENTER);
    setUsingDefault(true);
    setLocationStatus({ tone: 'info', message: 'Đang hiển thị trạm quanh trung tâm Hà Nội (Hồ Gươm), không phải vị trí thật của bạn.' });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.editorialHeader}>
        <View style={styles.headerTop}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>BUSNEXT HÀ NỘI</Text>
          {!spaciousHeader ? <TransitIllustration compact /> : null}
        </View>
        <View style={styles.headerRow}>
          <Text accessibilityRole="header" style={[styles.headline, { color: colors.ink }]}>Đi đâu hôm nay?</Text>
          {spaciousHeader ? <TransitIllustration /> : null}
        </View>
        <Text style={[styles.intro, { color: colors.muted }]}>Tra cứu lịch xe, trạm gần bạn và tìm đường bằng dữ liệu lịch chạy.</Text>
      </View>
      <View style={[styles.searchPanel, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.searchLabel, { color: colors.primary }]}>Bắt đầu chuyến đi</Text>
        <SearchField
          accessibilityLabel="Tìm trạm, tuyến hoặc chuyến"
          placeholder="Tìm trạm, tuyến hoặc chuyến…"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {trimmed.length === 1 ? <Text style={[styles.searchHint, { color: colors.ink }]}>Nhập ít nhất 2 ký tự để tìm kiếm.</Text> : null}
      </View>

      {searching ? (
        <View style={styles.section}>
          <SectionTitle>Kết quả tìm kiếm</SectionTitle>
          {search.isError ? <ErrorState message="Không tìm được dữ liệu. Kiểm tra kết nối rồi thử lại." onRetry={() => void search.refetch()} /> : null}
          {search.isPending && !search.isError ? <LoadingState rows={3} /> : null}
          {search.isSuccess && stops.length === 0 && routes.length === 0 && trips.length === 0 ? (
            <TransitEmptyState variant="search" title="Không có kết quả" message={`Không tìm thấy trạm, tuyến hoặc chuyến khớp "${trimmed}".`} />
          ) : null}
          {stops.length > 0 ? <Text accessibilityRole="header" style={[styles.resultGroup, { color: colors.muted }]}>Trạm</Text> : null}
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
          {routes.length > 0 ? <Text accessibilityRole="header" style={[styles.resultGroup, { color: colors.muted }]}>Tuyến xe</Text> : null}
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
          {trips.length > 0 ? <Text accessibilityRole="header" style={[styles.resultGroup, { color: colors.muted }]}>Chuyến</Text> : null}
          {trips.map((trip) => (
            <ListRow
              key={`trip-${trip.trip_id}`}
              leading={<Badge label={trip.short_name ?? trip.route_id} />}
              title={trip.headsign ?? trip.trip_id}
              meta={['Chuyến', trip.trip_id, trip.long_name, trip.direction_id == null ? null : `Chiều ${trip.direction_id}`].filter(Boolean).join(' · ')}
              accessibilityLabel={`Chuyến ${trip.trip_id}, ${trip.headsign ?? ''}, tuyến ${trip.short_name ?? trip.route_id ?? ''}`}
              onPress={() => navigation.navigate('TripDetails', { tripId: trip.trip_id, title: trip.headsign ?? undefined })}
            />
          ))}
        </View>
      ) : (
        <>
          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <QuickAction icon="git-compare-outline" title="Tìm đường" hint="Chọn điểm đi và đến" onPress={() => navigation.navigate('JourneyPlanner')} />
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
                  <Button label="Thử lại" icon="refresh" variant="outline" loading={locating} onPress={() => void loadNearby()} />
                  <Button label="Dùng vị trí trung tâm Hà Nội" icon="map-outline" variant="ghost" onPress={applyDefaultLocation} />
                </View>
              ) : null}
            </View>
          ) : null}

          {position ? (
            <View style={styles.section}>
              <SectionTitle
                right={(
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={locating ? 'Đang cập nhật vị trí' : 'Cập nhật vị trí'}
                    accessibilityState={{ disabled: locating, busy: locating }}
                    disabled={locating}
                    onPress={() => void loadNearby()}
                    style={({ pressed }) => [styles.refreshButton, { backgroundColor: colors.primarySoft }, (pressed || locating) && styles.pressed]}
                  >
                    {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="refresh" size={20} color={colors.primary} />}
                  </Pressable>
                )}
              >
                {usingDefault ? 'Trạm quanh Hồ Gươm' : 'Trạm gần bạn'}
              </SectionTitle>
              {!usingDefault && locationInfo ? <Text style={[styles.locationPromptCopy, { color: colors.muted }]}>{locationInfo}</Text> : null}
              <TransitMap points={mapPoints} height={230} onSelectStop={openStopById} />
              <View style={styles.mapGap} />
              {nearby.isError ? <ErrorState message="Không tải được trạm gần đây." onRetry={() => void nearby.refetch()} /> : null}
              {nearby.isPending && !nearby.isError ? <LoadingState rows={2} /> : null}
              {nearby.isSuccess && nearbyStops.length === 0 ? (
                <TransitEmptyState variant="nearby" title="Không có trạm trong bán kính 1 km" message="Thử tìm trạm theo tên hoặc mã trạm." />
              ) : null}
              {nearbyStops.map((stop) => (
                <Pressable
                  key={stop.stop_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Trạm ${stop.name}, ${stop.distance_meters !== undefined ? `${Math.round(stop.distance_meters)} mét` : stop.code ?? stop.stop_id}`}
                  onPress={() => navigation.navigate('StopDetails', { stop })}
                  style={({ pressed }) => [styles.nearbyRow, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.primarySoft }]}
                >
                  <Icon name="location-outline" size={22} color={colors.primary} />
                  <View style={styles.nearbyBody}>
                    <Text style={[styles.nearbyName, { color: colors.ink }]}>{stop.name}</Text>
                    <Text style={[styles.nearbyMeta, { color: colors.muted }]}>{stop.distance_meters !== undefined ? `${Math.round(stop.distance_meters)} m · ${stop.code ?? stop.stop_id}` : stop.code ?? stop.stop_id}</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <SectionTitle>Trạm gần bạn</SectionTitle>
              <View style={[styles.locationPrompt, { backgroundColor: colors.surfaceMuted }]}>
                <View style={styles.locationPromptHeading}>
                  <Icon name="navigate-outline" size={24} color={colors.primary} />
                  <Text style={[styles.locationPromptTitle, { color: colors.ink }]}>Khám phá trạm quanh bạn</Text>
                </View>
                <Text style={[styles.locationPromptCopy, { color: colors.muted }]}>Dùng vị trí của bạn để xem bản đồ và các trạm gần đây.</Text>
                <Button label={locating ? 'Đang định vị…' : 'Trạm gần đây'} icon="navigate-outline" variant="outline" loading={locating} onPress={() => void loadNearby()} />
              </View>
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
      style={({ pressed }) => [styles.quickCard, pressed && { backgroundColor: colors.primarySoft }, disabled && styles.pressed]}
    >
      <View style={styles.quickHeading}>
        <Icon name={icon} size={22} color={colors.primary} />
        <Text style={[styles.quickTitle, { color: colors.ink }]}>{title}</Text>
      </View>
      <Text style={[styles.quickHint, { color: colors.muted }]}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  editorialHeader: { marginBottom: spacing.lg },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  eyebrow: { flexShrink: 1, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  headline: { flex: 1, minWidth: 0, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  intro: { fontSize: 15, lineHeight: 23, marginTop: spacing.sm, maxWidth: 460 },
  searchPanel: { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm },
  searchLabel: { fontSize: 14, fontWeight: '700' },
  searchHint: { fontSize: 13, lineHeight: 20 },
  resultGroup: { fontSize: 14, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.sm },
  section: { marginTop: spacing.md },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  quickCard: { flexGrow: 1, flexBasis: 140, borderRadius: radius.sm, padding: spacing.sm, minHeight: 76 },
  quickHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickTitle: { flex: 1, fontWeight: '600', fontSize: 15 },
  quickHint: { fontSize: 13, marginTop: 6, lineHeight: 20 },
  nearbyRow: { minHeight: 76, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  nearbyBody: { flex: 1, minWidth: 0 },
  nearbyName: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  nearbyMeta: { fontSize: 13, marginTop: 4, lineHeight: 20 },
  locationPrompt: { borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  locationPromptHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationPromptTitle: { flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 24 },
  locationPromptCopy: { fontSize: 14, lineHeight: 22 },
  pressed: { opacity: 0.7 },
  refreshButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  mapGap: { height: spacing.md },
  locationActions: { marginTop: spacing.xs, gap: spacing.xs },
  detail: { fontSize: 11, marginTop: 2, marginBottom: 4 },
});
