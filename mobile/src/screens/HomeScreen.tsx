import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNearbyStops, useUnifiedSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ lat: number; lon: number }>();
  const [locationMessage, setLocationMessage] = useState('');
  const search = useUnifiedSearch(query);
  const nearby = useNearbyStops(position?.lat, position?.lon);
  const hasSearchResults = Boolean(search.data?.data && (search.data.data.stops.length > 0 || search.data.data.routes.length > 0));

  async function loadNearby() {
    setLocationMessage('Đang xin quyền vị trí…');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      setLocationMessage('Bạn chưa cấp quyền vị trí. Hãy dùng tìm kiếm thủ công.');
      return;
    }
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ lat: current.coords.latitude, lon: current.coords.longitude });
      setLocationMessage('Đã tìm các trạm quanh vị trí hiện tại.');
    } catch {
      setLocationMessage('Không lấy được vị trí. Hãy thử tìm trạm bằng tên.');
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={hasSearchResults ? [{ type: 'results' as const, key: 'results' }] : []}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>BUSNEXT HÀ NỘI</Text>
            <Text style={styles.title}>Đi đâu hôm nay?</Text>
            <Text style={styles.subtitle}>Tra cứu lịch xe và trạm gần bạn bằng dữ liệu vận hành.</Text>
            <TextInput
              accessibilityLabel="Tìm trạm hoặc tuyến"
              accessibilityRole="search"
              placeholder="Tìm trạm hoặc tuyến…"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            <View style={styles.quickRow}>
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('JourneyPlanner')} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
                <Text style={styles.quickIcon}>⇄</Text>
                <Text style={styles.quickTitle}>Tìm đường</Text>
                <Text style={styles.quickHint}>Chọn điểm đi và đến</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={loadNearby} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
                <Text style={styles.quickIcon}>⌖</Text>
                <Text style={styles.quickTitle}>Trạm gần đây</Text>
                <Text style={styles.quickHint}>Dùng vị trí GPS</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('MainTabs', { screen: 'StopSearch' })} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
                <Text style={styles.quickIcon}>⌕</Text>
                <Text style={styles.quickTitle}>Tìm trạm</Text>
                <Text style={styles.quickHint}>Theo tên hoặc mã</Text>
              </Pressable>
            </View>
            {locationMessage ? <Text style={styles.locationMessage} accessibilityLiveRegion="polite">{locationMessage}</Text> : null}
            {search.isFetching ? <View style={styles.skeleton} accessibilityLiveRegion="polite" /> : null}
            {search.isError ? <Text style={styles.error} accessibilityLiveRegion="polite">Không tìm được dữ liệu. Kiểm tra kết nối rồi thử lại.</Text> : null}
            {query.trim().length > 1 ? <Text style={styles.sectionTitle}>Kết quả tìm kiếm</Text> : null}
          </>
        }
        renderItem={() => (
          <View>
            {(search.data?.data.stops ?? []).map((stop) => (
              <Pressable key={`stop-${stop.stop_id}`} style={styles.resultRow} onPress={() => navigation.navigate('StopDetails', { stop })} accessibilityRole="button" accessibilityLabel={`Trạm ${stop.name}`}>
                <Text style={styles.resultType}>TRẠM</Text>
                <View style={styles.resultBody}><Text style={styles.resultTitle}>{stop.name}</Text><Text style={styles.resultMeta}>{stop.code ?? stop.stop_id}</Text></View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
            {(search.data?.data.routes ?? []).map((route) => (
              <Pressable key={`route-${route.route_id}`} style={styles.resultRow} onPress={() => navigation.navigate('RouteDetails', { route })} accessibilityRole="button" accessibilityLabel={`Tuyến ${route.short_name ?? route.route_id}`}>
                <Text style={[styles.resultType, styles.routeType]}>TUYẾN</Text>
                <View style={styles.resultBody}><Text style={styles.resultTitle}>{route.short_name ?? route.route_id}</Text><Text style={styles.resultMeta}>{route.long_name ?? 'Chưa có tên tuyến'}</Text></View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
        ListEmptyComponent={
          position ? (
            <View>
              <Text style={styles.sectionTitle}>Trạm gần bạn</Text>
              {nearby.isFetching ? <View style={styles.skeleton} accessibilityLiveRegion="polite" /> : null}
              {nearby.isError ? <Text style={styles.error} accessibilityLiveRegion="polite">Không tải được trạm gần đây.</Text> : null}
              {(nearby.data?.data ?? []).map((stop) => (
                <Pressable key={stop.stop_id} style={styles.resultRow} onPress={() => navigation.navigate('StopDetails', { stop })} accessibilityRole="button">
                  <Text style={styles.resultType}>GẦN</Text>
                  <View style={styles.resultBody}><Text style={styles.resultTitle}>{stop.name}</Text><Text style={styles.resultMeta}>{stop.distance_meters ? `${Math.round(stop.distance_meters)} m` : stop.stop_id}</Text></View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : <Text style={styles.muted}>Tìm kiếm trạm hoặc tuyến để bắt đầu.</Text>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 30 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: spacing.md },
  searchInput: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, minHeight: 54, paddingHorizontal: 17, fontSize: 16, color: colors.ink },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quickCard: { flex: 1, backgroundColor: colors.primarySoft, borderRadius: 16, padding: 14, minHeight: 106 },
  pressed: { opacity: 0.72 },
  quickIcon: { color: colors.primary, fontSize: 24, fontWeight: '700' },
  quickTitle: { color: colors.ink, fontWeight: '800', marginTop: 8 },
  quickHint: { color: colors.muted, fontSize: 11, marginTop: 4 },
  locationMessage: { color: colors.primary, fontSize: 12, marginTop: 10 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  resultRow: { backgroundColor: colors.surface, borderRadius: 15, padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', minHeight: 66, shadowColor: colors.ink, shadowOpacity: 0.04, shadowRadius: 7, elevation: 2 },
  resultType: { color: colors.primary, fontSize: 10, fontWeight: '800', width: 42 },
  routeType: { color: colors.secondary },
  resultBody: { flex: 1 },
  resultTitle: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  resultMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.primary, fontSize: 27, lineHeight: 27 },
  muted: { color: colors.muted, textAlign: 'center', marginTop: 28 },
  error: { backgroundColor: colors.dangerSurface, color: colors.danger, borderRadius: 12, padding: 12, marginTop: 12 },
  skeleton: { height: 66, borderRadius: 15, backgroundColor: '#E6E8F0', marginTop: 12 },
});
