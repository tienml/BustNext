import { useState } from 'react';
import { AccessibilityInfo, FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStopSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { spacing, useTheme } from '../theme';
import { Badge, EmptyState, ErrorState, ListRow, LoadingState, ScreenHeader, SearchField } from '../components/ui';

export function StopSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const stops = useStopSearch(query);
  const ready = query.trim().length > 1;
  const items = ready ? stops.data?.data ?? [] : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.stop_id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <ScreenHeader eyebrow="BUSNEXT HÀ NỘI" title="Tìm trạm" subtitle="Nhập tên hoặc mã trạm để xem giờ xe kế tiếp." />
            <SearchField
              accessibilityLabel="Tên hoặc mã trạm"
              accessibilityRole="search"
              placeholder="Ví dụ: Kim Mã hoặc KM001"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            <View style={styles.gap} />
            {ready && stops.isError ? <ErrorState message="Không tải được danh sách trạm." onRetry={() => void stops.refetch()} /> : null}
            {ready && stops.isLoading ? <LoadingState /> : null}
          </>
        }
        ListEmptyComponent={
          !ready ? (
            <EmptyState icon="search-outline" title="Bắt đầu tìm kiếm" message="Nhập ít nhất 2 ký tự." />
          ) : stops.isLoading || stops.isError ? null : (
            <EmptyState icon="location-outline" title="Không tìm thấy trạm" message={`Không có trạm nào khớp với “${query.trim()}”.`} />
          )
        }
        renderItem={({ item }) => (
          <ListRow
            leading={<Badge icon="location" />}
            title={item.name}
            meta={`Mã trạm ${item.code ?? item.stop_id}`}
            accessibilityLabel={`Trạm ${item.name}`}
            onPress={() => {
              AccessibilityInfo.announceForAccessibility?.(`Đã chọn trạm ${item.name}`);
              navigation.navigate('StopDetails', { stop: item });
            }}
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
