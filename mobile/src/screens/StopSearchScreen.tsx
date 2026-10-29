import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AccessibilityInfo } from 'react-native';
import { useStopSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

export function StopSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const stops = useStopSearch(query);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>BUSNEXT HÀ NỘI</Text>
      <Text style={styles.title}>Tìm trạm gần bạn</Text>
      <Text style={styles.subtitle}>Nhập tên, mã trạm hoặc khu vực để xem giờ xe.</Text>
      <TextInput
        accessibilityLabel="Tên hoặc mã trạm"
        accessibilityRole="search"
        placeholder="Ví dụ: Bờ Hồ hoặc KM001"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        style={styles.input}
      />
      {stops.isFetching ? <View style={styles.skeletonRow} accessibilityLiveRegion="polite" /> : null}
      {stops.isError ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>Không tải được danh sách trạm.</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => stops.refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={stops.data?.data ?? []}
        keyExtractor={(item) => item.stop_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.muted}>
            {stops.isError
              ? 'Kiểm tra kết nối rồi thử lại.'
              : query.trim().length > 1
                ? 'Không tìm thấy trạm phù hợp.'
                : 'Nhập ít nhất 2 ký tự để bắt đầu.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Trạm ${item.name}`}
            hitSlop={8}
            onPress={() => {
              AccessibilityInfo.announceForAccessibility?.(`Đã chọn trạm ${item.name}`);
              navigation.navigate('StopDetails', { stop: item });
            }}
          >
            <View style={styles.stopBadge}><Text style={styles.stopId}>{item.code ?? item.stop_id}</Text></View>
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.name}</Text>
              {item.lat !== undefined && item.lon !== undefined ? (
                <Text style={styles.coords}>{`${item.lat}, ${item.lon}`}</Text>
              ) : null}
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
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: spacing.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 15, paddingHorizontal: 16, minHeight: 52, fontSize: 16, color: colors.ink, marginBottom: spacing.md },
  list: { paddingBottom: 24 },
  row: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', minHeight: 72, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 7, elevation: 2 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  stopBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7, marginRight: 12, maxWidth: 80 },
  stopId: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  rowBody: { flex: 1 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  coords: { color: colors.muted, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.primary, fontSize: 28, lineHeight: 28, marginLeft: 8 },
  muted: { color: colors.muted, textAlign: 'center', marginTop: 28 },
  errorBox: { backgroundColor: colors.dangerSurface, borderRadius: 12, padding: 12, marginBottom: spacing.md },
  errorText: { color: colors.danger, marginBottom: 8 },
  retryButton: { alignSelf: 'flex-start', backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  skeletonRow: { height: 72, borderRadius: 16, backgroundColor: '#E6E8F0', marginBottom: spacing.md },
});
