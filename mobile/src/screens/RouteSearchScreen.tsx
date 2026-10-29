import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRouteSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { spacing, useTheme } from '../theme';
import { Badge, EmptyState, ErrorState, ListRow, LoadingState, ScreenHeader, SearchField } from '../components/ui';

export function RouteSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const routes = useRouteSearch(query);
  const ready = query.trim().length > 0;
  const items = ready ? routes.data?.data ?? [] : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.route_id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <ScreenHeader eyebrow="TRA CỨU TUYẾN" title="Tuyến xe" subtitle="Tìm theo số hoặc tên tuyến để xem lộ trình và các chuyến trong ngày." accent="secondary" />
            <SearchField
              icon="bus-outline"
              accessibilityLabel="Mã hoặc tên tuyến"
              accessibilityRole="search"
              placeholder="Ví dụ: 01 hoặc Gia Lâm"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            <View style={styles.gap} />
            {ready && routes.isError ? <ErrorState message="Không tải được danh sách tuyến." onRetry={() => void routes.refetch()} /> : null}
            {ready && routes.isLoading ? <LoadingState /> : null}
          </>
        }
        ListEmptyComponent={
          !ready ? (
            <EmptyState icon="bus-outline" title="Bắt đầu tìm kiếm" message="Nhập số tuyến hoặc tên điểm đầu/cuối." />
          ) : routes.isLoading || routes.isError ? null : (
            <EmptyState icon="bus-outline" title="Không tìm thấy tuyến" message={`Không có tuyến nào khớp với “${query.trim()}”.`} />
          )
        }
        renderItem={({ item }) => (
          <ListRow
            leading={<Badge label={item.short_name ?? item.route_id} tone="secondary" />}
            title={item.long_name ?? 'Chưa có tên tuyến'}
            meta={item.agency_name ?? 'Dữ liệu GTFS'}
            accessibilityLabel={`Tuyến ${item.short_name ?? item.route_id}`}
            onPress={() => navigation.navigate('RouteDetails', { route: item })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 30, flexGrow: 1 },
  gap: { height: spacing.md },
});
