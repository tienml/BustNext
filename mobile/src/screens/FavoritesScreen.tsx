import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../navigation/types';
import { spacing, useTheme } from '../theme';
import type { Favorite, Route, Stop } from '../api/client';
import { Badge, Button, EmptyState, ErrorState, ListRow, LoadingState, ScreenHeader } from '../components/ui';

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

export function FavoritesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const auth = useAuth();
  const favorites = useFavorites();

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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader eyebrow="ĐÃ LƯU" title="Yêu thích của bạn" />
        <EmptyState
          icon="heart-outline"
          title="Chưa đăng nhập"
          message="Đăng nhập để lưu và đồng bộ trạm, tuyến yêu thích giữa các thiết bị."
          action={<View style={styles.action}><Button label="Đăng nhập" icon="log-in-outline" onPress={() => navigation.navigate('MainTabs', { screen: 'Account' })} /></View>}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={favorites.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={favorites.isRefetching}
        onRefresh={() => void favorites.refetch()}
        ListHeaderComponent={
          <>
            <ScreenHeader eyebrow="ĐÃ LƯU" title="Yêu thích của bạn" subtitle={auth.user.email} />
            {favorites.isError ? <ErrorState message="Không tải được danh sách yêu thích." onRetry={() => void favorites.refetch()} /> : null}
            {favorites.isLoading ? <LoadingState /> : null}
          </>
        }
        ListEmptyComponent={
          favorites.isLoading || favorites.isError ? null : (
            <EmptyState icon="heart-outline" title="Chưa có mục nào" message="Mở một trạm hoặc tuyến rồi bấm biểu tượng trái tim để lưu." />
          )
        }
        renderItem={({ item }) => (
          <ListRow
            leading={<Badge icon={item.type === 'stop' ? 'location' : 'bus'} tone={item.type === 'stop' ? 'primary' : 'secondary'} />}
            title={favoriteLabel(item)}
            meta={favoriteMeta(item)}
            accessibilityLabel={`${item.type === 'stop' ? 'Trạm' : 'Tuyến'} ${favoriteLabel(item)}`}
            onPress={() => open(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 0 },
  list: { padding: spacing.lg, paddingBottom: 30, flexGrow: 1 },
  action: { marginTop: 16, alignSelf: 'stretch' },
});
