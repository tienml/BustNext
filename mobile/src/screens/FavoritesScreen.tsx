import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';
import type { Favorite } from '../api/client';

function favoriteLabel(item: Favorite): string {
  if (!item.entity) return item.entity_id;
  if (item.type === 'stop' && 'name' in item.entity) return item.entity.name;
  if (item.type === 'route' && 'short_name' in item.entity) return item.entity.short_name ?? item.entity_id;
  return item.entity_id;
}

function favoriteMeta(item: Favorite): string {
  if (!item.entity) return 'Dữ liệu không còn trong phiên bản đang hoạt động';
  if (item.type === 'stop' && 'code' in item.entity) return item.entity.code ?? item.entity_id;
  if (item.type === 'route' && 'long_name' in item.entity) return item.entity.long_name ?? item.entity_id;
  return item.entity_id;
}

export function FavoritesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const favorites = useFavorites();

  if (!auth.user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Yêu thích của bạn</Text>
        <Text style={styles.muted}>Đăng nhập để đồng bộ trạm và tuyến yêu thích.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>ĐÃ LƯU</Text>
      <Text style={styles.title}>Yêu thích của bạn</Text>
      <Text style={styles.subtitle}>{auth.user.email}</Text>
      {favorites.isFetching ? <View style={styles.skeleton} accessibilityLiveRegion="polite" /> : null}
      {favorites.isError ? <Text style={styles.error} accessibilityLiveRegion="polite">Không tải được danh sách yêu thích.</Text> : null}
      <FlatList
        data={favorites.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>Bạn chưa lưu trạm hoặc tuyến nào.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            onPress={() => item.type === 'stop'
              ? navigation.navigate('MainTabs', { screen: 'StopSearch' })
              : navigation.navigate('MainTabs', { screen: 'RouteSearch' })}
          >
            <View style={[styles.badge, item.type === 'route' && styles.routeBadge]}>
              <Text style={styles.badgeText}>{item.type === 'stop' ? 'TRẠM' : 'TUYẾN'}</Text>
            </View>
              <View style={styles.body}>
                <Text style={styles.entity}>{favoriteLabel(item)}</Text>
                <Text style={styles.meta}>{favoriteMeta(item)}</Text>
              </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 5, marginBottom: 18 },
  list: { paddingBottom: 24 },
  row: { backgroundColor: colors.surface, borderRadius: 15, padding: 14, marginBottom: 10, minHeight: 70, flexDirection: 'row', alignItems: 'center', shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 7, elevation: 2 },
  pressed: { opacity: 0.72 },
  badge: { backgroundColor: colors.primarySoft, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 8, marginRight: 12 },
  routeBadge: { backgroundColor: '#E5EBFF' },
  badgeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  body: { flex: 1 },
  entity: { color: colors.ink, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.primary, fontSize: 28 },
  muted: { color: colors.muted, textAlign: 'center', marginTop: 28, lineHeight: 20 },
  error: { backgroundColor: colors.dangerSurface, color: colors.danger, borderRadius: 12, padding: 12, marginBottom: 12 },
  skeleton: { height: 70, borderRadius: 15, backgroundColor: '#E6E8F0', marginBottom: 12 },
});
