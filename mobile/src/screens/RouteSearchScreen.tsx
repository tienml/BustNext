import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRouteSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { spacing, useTheme } from '../theme';
import { ChipPicker } from '../components/admin';
import { Button, EmptyState, ErrorState, LoadingState, ScreenHeader, SearchField, SectionTitle } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransitSignRow } from '../components/TransitSignRow';

export function RouteSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [routeType, setRouteType] = useState(-1);
  const routes = useRouteSearch(query, routeType === -1 ? undefined : routeType);
  const ready = query.trim().length > 0 || routeType !== -1;
  const items = ready ? routes.data?.data ?? [] : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.route_id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { paddingBottom: spacing.xl + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}
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
            <ChipPicker label="LOẠI PHƯƠNG TIỆN" value={routeType} onChange={setRouteType} options={[
              { value: -1, label: 'Tất cả' }, { value: 3, label: 'Xe buýt' },
              { value: 0, label: 'Tram' }, { value: 1, label: 'Metro' },
              { value: 2, label: 'Đường sắt' }, { value: 4, label: 'Phà' },
              { value: 5, label: 'Cáp kéo' }, { value: 6, label: 'Cáp treo' }, { value: 7, label: 'Đường sắt leo núi' },
            ]} />
            <Button label="Tìm chuyến toàn mạng" icon="search" variant="ghost" onPress={() => navigation.navigate('TripSearch')} />
            {ready && routes.isError ? <ErrorState message="Không tải được danh sách tuyến." onRetry={() => void routes.refetch()} /> : null}
            {ready && routes.isLoading ? <LoadingState /> : null}
            {ready && routes.isSuccess ? <SectionTitle>{`Kết quả tuyến (${items.length} · tối đa 20)`}</SectionTitle> : null}
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
          <TransitSignRow
            code={item.short_name ?? item.route_id}
            title={item.long_name ?? 'Chưa có tên tuyến'}
            meta={item.agency_name ?? 'Dữ liệu GTFS'}
            label={`Tuyến ${item.short_name ?? item.route_id}, ${item.long_name ?? 'chưa có tên tuyến'}`}
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
