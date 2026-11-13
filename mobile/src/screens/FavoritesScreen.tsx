import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, SectionList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import type { Favorite, Route, Stop } from '../api/client';
import { Button, ErrorState, Icon, LoadingState, ScreenHeader } from '../components/ui';
import { TransitEmptyState, TransitIllustration } from '../components/TransitIllustration';

function favoriteLabel(item: Favorite): string {
  if (!item.entity) return item.entity_id;
  if (item.type === 'stop' && 'name' in item.entity) return item.entity.name;
  if (item.type === 'route' && 'route_id' in item.entity) {
    const route = item.entity as Route;
    return route.short_name ? `Tuyến ${route.short_name}` : item.entity_id;
  }
  return item.entity_id;
}

function favoriteMeta(item: Favorite): string {
  if (!item.entity) return 'Không còn trong dữ liệu đang hoạt động';
  if (item.type === 'stop') return `Mã trạm ${(item.entity as Stop).code ?? item.entity_id}`;
  return (item.entity as Route).long_name ?? item.entity_id;
}

function FavoriteEntry({ item, onPress }: { item: Favorite; onPress: () => void }) {
  const { colors } = useTheme();
  const isStop = item.type === 'stop';
  const route = !isStop && item.entity && 'route_id' in item.entity ? item.entity as Route : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isStop ? 'Trạm' : 'Tuyến'} ${favoriteLabel(item)}, ${favoriteMeta(item)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.entry, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {isStop ? (
        <View style={[styles.stopSign, { backgroundColor: colors.primarySoft }]}>
          <Icon name="location-outline" size={22} color={colors.primary} />
        </View>
      ) : (
        <View style={[styles.routeSign, { backgroundColor: colors.secondarySoft }]}>
          <Icon name="bus-outline" size={16} color={colors.secondary} />
          <Text style={[styles.routeCode, { color: colors.secondary }]}>{route?.short_name ?? item.entity_id}</Text>
        </View>
      )}
      <View style={styles.entryBody}>
        <Text style={[styles.entryTitle, { color: colors.ink }]}>{favoriteLabel(item)}</Text>
        <Text style={[styles.entryMeta, { color: colors.muted }]}>{favoriteMeta(item)}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function FavoritesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const auth = useAuth();
  const favorites = useFavorites();
  const sections = [
    { key: 'stops', title: 'Trạm đã lưu', description: 'Mở trạm để xem giờ xe', data: favorites.items.filter((item) => item.type === 'stop') },
    { key: 'routes', title: 'Tuyến đã lưu', description: 'Mở tuyến để xem lộ trình', data: favorites.items.filter((item) => item.type === 'route') },
  ].filter((section) => section.data.length > 0);

  function open(item: Favorite) {
    if (item.type === 'stop') {
      const stop: Stop = item.entity && 'name' in item.entity ? (item.entity as Stop) : { stop_id: item.entity_id, name: item.entity_id };
      navigation.navigate('StopDetails', { stop });
    } else {
      const route: Route = item.entity && 'route_id' in item.entity ? (item.entity as Route) : { route_id: item.entity_id };
      navigation.navigate('RouteDetails', { route });
    }
  }

  if (!auth.user) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.list}>
        <ScreenHeader eyebrow="ĐÃ LƯU" title="Yêu thích của bạn" subtitle="Giữ những điểm dừng và tuyến xe bạn muốn tìm lại." />
        <View style={styles.signedOut}>
          <TransitIllustration variant="favorites" />
          <Text accessibilityRole="header" style={[styles.emptyTitle, { color: colors.ink }]}>Chưa đăng nhập</Text>
          <Text style={[styles.emptyMessage, { color: colors.muted }]}>Đăng nhập để lưu và đồng bộ trạm, tuyến yêu thích giữa các thiết bị.</Text>
          <View style={styles.action}><Button label="Đăng nhập" icon="log-in-outline" onPress={() => navigation.navigate('MainTabs', { screen: 'Account' })} /></View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshing={favorites.isRefetching}
        onRefresh={() => void favorites.refetch()}
        ListHeaderComponent={
          <>
            <ScreenHeader eyebrow="ĐÃ LƯU" title="Yêu thích của bạn" subtitle="Trạm quen, tuyến cần. Tất cả ở một nơi để dễ tìm lại." />
            {favorites.isError ? <ErrorState message="Không tải được danh sách yêu thích." onRetry={() => void favorites.refetch()} /> : null}
            {favorites.isLoading ? <LoadingState /> : null}
          </>
        }
        ListEmptyComponent={
          favorites.isLoading || favorites.isError ? null : (
            <View>
              <TransitEmptyState variant="favorites" title="Lưu lại để lần sau dễ tìm" message="Mở một trạm hoặc tuyến rồi bấm biểu tượng trái tim để lưu. Các mục đã lưu sẽ được chia thành trạm và tuyến tại đây." />
              <Button label="Khám phá tuyến" icon="bus-outline" variant="outline" onPress={() => navigation.navigate('MainTabs', { screen: 'RouteSearch' })} />
            </View>
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeading}>
            <View style={[styles.sectionRule, { backgroundColor: section.key === 'stops' ? colors.primary : colors.secondary }]} />
            <View style={styles.entryBody}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.ink }]}>{section.title} · {section.data.length}</Text>
              <Text style={[styles.sectionDescription, { color: colors.muted }]}>{section.description}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => <FavoriteEntry item={item} onPress={() => open(item)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 32, flexGrow: 1 },
  sectionHeading: { flexDirection: 'row', gap: 12, alignItems: 'stretch', marginTop: 16, marginBottom: 8 },
  sectionRule: { width: 3, borderRadius: 2 },
  sectionTitle: { fontSize: 19, lineHeight: 27, fontWeight: '800' },
  sectionDescription: { fontSize: 13, lineHeight: 20, marginTop: 2 },
  entry: { flexDirection: 'row', alignItems: 'center', minHeight: 80, gap: 12, paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  stopSign: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  routeSign: { width: 64, minHeight: 52, padding: 6, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', gap: 4 },
  routeCode: { fontSize: 14, lineHeight: 20, fontWeight: '800', textAlign: 'center' },
  entryBody: { flex: 1, minWidth: 0 },
  entryTitle: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  entryMeta: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  signedOut: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyTitle: { fontSize: 20, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  emptyMessage: { fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 360 },
  action: { marginTop: 12, alignSelf: 'stretch' },
});
