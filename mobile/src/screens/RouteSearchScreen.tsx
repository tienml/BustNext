import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRouteSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

export function RouteSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const routes = useRouteSearch(query);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TRA CỨU TUYẾN</Text>
      <Text style={styles.title}>Tuyến xe quanh Hà Nội</Text>
      <Text style={styles.subtitle}>Tìm theo mã tuyến hoặc tên tuyến để xem các chuyến trong ngày.</Text>
      <TextInput
        accessibilityLabel="Mã hoặc tên tuyến"
        accessibilityRole="search"
        placeholder="Ví dụ: 32 hoặc Giáp Bát"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        style={styles.input}
      />
      {routes.isFetching ? <View style={styles.skeletonRow} accessibilityLiveRegion="polite" /> : null}
      {routes.isError ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>Không tải được danh sách tuyến.</Text>
          <Pressable accessibilityRole="button" onPress={() => routes.refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={routes.data?.data ?? []}
        keyExtractor={(item) => item.route_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>{query.trim() ? 'Không tìm thấy tuyến phù hợp.' : 'Nhập mã tuyến để bắt đầu.'}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Tuyến ${item.short_name ?? item.route_id}`}
            onPress={() => navigation.navigate('RouteDetails', { route: item })}
          >
            <View style={styles.routeBadge}><Text style={styles.routeCode}>{item.short_name ?? item.route_id}</Text></View>
            <View style={styles.rowBody}>
              <Text style={styles.routeName}>{item.long_name ?? 'Chưa có tên tuyến'}</Text>
              <Text style={styles.agency}>{item.agency_name ?? 'Dữ liệu GTFS'}</Text>
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
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: spacing.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 15, paddingHorizontal: 16, minHeight: 52, fontSize: 16, color: colors.ink, marginBottom: spacing.md },
  list: { paddingBottom: 24 },
  row: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', minHeight: 76, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 7, elevation: 2 },
  pressed: { opacity: 0.72 },
  routeBadge: { backgroundColor: '#E5EBFF', borderRadius: 12, minWidth: 54, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  routeCode: { color: colors.secondary, fontWeight: '800', fontSize: 16 },
  rowBody: { flex: 1 },
  routeName: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  agency: { color: colors.muted, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.secondary, fontSize: 28, lineHeight: 28, marginLeft: 8 },
  muted: { color: colors.muted, textAlign: 'center', marginTop: 28 },
  errorBox: { backgroundColor: colors.dangerSurface, borderRadius: 12, padding: 12, marginBottom: spacing.md },
  errorText: { color: colors.danger, marginBottom: 8 },
  retryButton: { alignSelf: 'flex-start', backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  skeletonRow: { height: 76, borderRadius: 16, backgroundColor: '#E6E8F0', marginBottom: spacing.md },
});
