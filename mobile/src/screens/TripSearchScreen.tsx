import { useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useRouteSearch, useTripSearch } from '../hooks/useTransitQueries';
import { useScreenActive } from '../hooks/useScreenActive';
import { getTransitDateTime, isTransitDate } from '../utils/transitTime';
import { radius, spacing, useTheme } from '../theme';
import { TransitSignRow } from '../components/TransitSignRow';
import { ChipPicker } from '../components/admin';
import { Badge, Button, EmptyState, ErrorState, Icon, ListRow, LoadingState, Notice, ScreenHeader, SearchField } from '../components/ui';

const vehicleTypes = [
  { value: -1, label: 'Tất cả' }, { value: 0, label: 'Tram' }, { value: 1, label: 'Metro' },
  { value: 2, label: 'Đường sắt' }, { value: 3, label: 'Xe buýt' }, { value: 4, label: 'Phà' },
  { value: 5, label: 'Cáp kéo' }, { value: 6, label: 'Cáp treo' }, { value: 7, label: 'Đường sắt leo núi' },
  { value: 11, label: 'Xe điện bánh hơi' }, { value: 12, label: 'Đường sắt một ray' },
];
const defaultFilters = () => ({ routeId: '', routeLabel: '', routeType: -1, direction: -1, date: getTransitDateTime().date, limit: 50 });

export function TripSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const active = useScreenActive();
  // Keyword search is automatic. Other controls are drafts until Apply is pressed.
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState(defaultFilters);
  const [draft, setDraft] = useState(applied);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [routeQuery, setRouteQuery] = useState('');
  const [error, setError] = useState('');
  const routeMatches = useRouteSearch(active && advancedOpen ? routeQuery : '');
  const trips = useTripSearch({ q, route_id: applied.routeId, route_type: applied.routeType < 0 ? undefined : applied.routeType,
    direction_id: applied.direction < 0 ? undefined : applied.direction, date: applied.date || undefined, limit: applied.limit }, active);
  const rows = trips.data?.data ?? [];
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const advancedCount = Number(applied.routeId !== '') + Number(applied.routeType >= 0) + Number(applied.direction >= 0) + Number(applied.limit !== 50);
  const summary = [applied.date || 'Mọi ngày dịch vụ', applied.routeId ? `Tuyến ${applied.routeLabel || applied.routeId}` : 'Mọi tuyến',
    applied.routeType >= 0 ? vehicleTypes.find((type) => type.value === applied.routeType)?.label : null,
    applied.direction >= 0 ? `Chiều ${applied.direction}` : null, `Tối đa ${applied.limit} chuyến`].filter(Boolean).join(' · ');

  function applyFilters() {
    if (draft.date && !isTransitDate(draft.date)) { setError('Nhập ngày hợp lệ dạng YYYY-MM-DD hoặc để trống để xem mọi ngày.'); return; }
    setError(''); setApplied({ ...draft, routeId: draft.routeId.trim() }); Keyboard.dismiss();
    if (!dirty) void trips.refetch();
  }
  function resetFilters() {
    const defaults = defaultFilters();
    setQ(''); setDraft(defaults); setApplied(defaults); setRouteQuery(''); setError('');
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={rows}
      keyExtractor={(item) => item.trip_id}
      ListHeaderComponent={<>
        <ScreenHeader eyebrow="TRA CỨU CHUYẾN" title="Chuyến toàn mạng" subtitle="Tìm mã chuyến, hướng đến hoặc tên tuyến trong dữ liệu đang dùng." />
        <View style={[styles.fields, styles.searchPanel, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={{ color: colors.ink }}>Từ khóa · tự tìm khi nhập</Text>
          <SearchField accessibilityLabel="Mã chuyến, hướng đến hoặc tên tuyến" value={q} onChangeText={setQ} maxLength={120} autoCorrect={false} returnKeyType="search" />
          <Text style={{ color: colors.ink }}>Ngày dịch vụ (YYYY-MM-DD)</Text>
          <SearchField accessibilityLabel="Ngày dịch vụ, năm-tháng-ngày, có thể để trống" icon="calendar-outline" value={draft.date} onChangeText={(date) => setDraft({ ...draft, date })} maxLength={10} autoCorrect={false} autoCapitalize="none" onSubmitEditing={applyFilters} />
          {error ? <ErrorState message={error} /> : null}
          <View style={styles.shortcuts}>
            <Button label="Hôm nay" variant="ghost" onPress={() => { setDraft({ ...draft, date: getTransitDateTime().date }); setError(''); }} />
            <Button label="Mọi ngày" variant="ghost" onPress={() => { setDraft({ ...draft, date: '' }); setError(''); }} />
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: advancedOpen }}
            onPress={() => setAdvancedOpen((open) => !open)}
            style={({ pressed }) => [styles.disclosure, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.72 : 1 }]}>
            <Text style={[styles.disclosureText, { color: colors.primary }]}>Bộ lọc nâng cao{advancedCount ? ` · ${advancedCount} đang dùng` : ''}</Text>
            <Icon name={advancedOpen ? 'chevron-up' : 'chevron-down'} color={colors.primary} />
          </Pressable>
          {advancedOpen ? <View style={styles.fields}>
            <Text style={{ color: colors.ink }}>Chọn tuyến theo số hoặc tên</Text>
            <SearchField accessibilityLabel="Tìm tuyến để lọc chuyến" value={routeQuery} onChangeText={setRouteQuery} placeholder="Nhập số hoặc tên tuyến" autoCorrect={false} maxLength={120} />
            {routeQuery.trim() ? <>
              {routeMatches.isLoading ? <LoadingState rows={1} /> : null}
              {routeMatches.isError ? <ErrorState message="Không tìm được tuyến. Bạn vẫn có thể nhập mã tuyến bên dưới." onRetry={() => void routeMatches.refetch()} /> : null}
              {routeMatches.data?.data.map((route) => <ListRow key={route.route_id} leading={<Badge label={route.short_name ?? route.route_id} />}
                title={route.long_name ?? route.route_id} meta={`Chọn tuyến · ${route.route_id}`}
                onPress={() => { setDraft({ ...draft, routeId: route.route_id, routeLabel: route.short_name ?? route.long_name ?? route.route_id }); setRouteQuery(''); Keyboard.dismiss(); }} />)}
              {routeMatches.isSuccess && !routeMatches.data.data.length ? <Text style={{ color: colors.muted }}>Không có tuyến phù hợp. Thử tên khác hoặc nhập mã chính xác.</Text> : null}
              <Text style={{ color: colors.muted }}>Gợi ý tối đa 20 tuyến. Thu hẹp từ khóa nếu chưa thấy tuyến cần tìm.</Text>
            </> : null}
            {draft.routeLabel ? <Text style={{ color: colors.primary }}>Đã chọn: {draft.routeLabel}</Text> : null}
            <Text style={{ color: colors.ink }}>Mã tuyến chính xác (không bắt buộc)</Text>
            <SearchField accessibilityLabel="Mã tuyến chính xác" value={draft.routeId} onChangeText={(routeId) => setDraft({ ...draft, routeId, routeLabel: '' })} maxLength={255} autoCorrect={false} autoCapitalize="none" />
            <ChipPicker label="LOẠI PHƯƠNG TIỆN" value={draft.routeType} onChange={(routeType) => setDraft({ ...draft, routeType })} options={vehicleTypes} />
            <ChipPicker label="CHIỀU GTFS" value={draft.direction} onChange={(direction) => setDraft({ ...draft, direction })} options={[
              { value: -1, label: 'Tất cả' }, { value: 0, label: 'Chiều 0' }, { value: 1, label: 'Chiều 1' },
            ]} />
            <Text style={{ color: colors.muted }}>Chiều 0/1 do đơn vị vận hành quy định, không nhất thiết là lượt đi/về.</Text>
            <ChipPicker label="SỐ KẾT QUẢ TỐI ĐA" value={draft.limit} onChange={(limit) => setDraft({ ...draft, limit })} options={[25, 50, 100, 200].map((value) => ({ value, label: String(value) }))} />
          </View> : null}
          {dirty ? <Text accessibilityLiveRegion="polite" style={{ color: colors.warning }}>Ngày / bộ lọc có thay đổi chưa áp dụng. Kết quả bên dưới vẫn dùng bộ lọc cũ.</Text> : null}
          <Button label={dirty ? 'Áp dụng ngày và bộ lọc' : 'Tra cứu lại'} onPress={applyFilters} disabled={!dirty && trips.isFetching} />
          <Button label="Đặt lại bộ lọc · hôm nay" variant="ghost" onPress={resetFilters} />
        </View>
        <View style={[styles.appliedPanel, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.appliedLabel, { color: colors.primary }]}>ĐANG ÁP DỤNG</Text>
          <Text style={[styles.summary, { color: colors.muted }]}>{summary}</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.resultTitle, { color: colors.ink }]}>{rows.length} chuyến trong kết quả</Text>
        {rows.length >= applied.limit ? <Notice message={`Đang hiển thị tối đa ${applied.limit} chuyến, không phải tổng toàn mạng. Thu hẹp bộ lọc hoặc tăng giới hạn.`} /> : null}
        {trips.isFetching && !trips.isLoading ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Đang cập nhật…</Text> : null}
        {trips.isLoading ? <LoadingState /> : null}
        {trips.isError ? <ErrorState message="Không tải được danh sách chuyến." onRetry={() => void trips.refetch()} /> : null}
      </>}
      ListEmptyComponent={trips.isPending || trips.isError ? null : <EmptyState title="Không có chuyến phù hợp" message="Thử đổi từ khóa, ngày dịch vụ hoặc bộ lọc rồi áp dụng." />}
      renderItem={({ item }) => <TransitSignRow code={item.short_name ?? item.route_id ?? '—'} title={item.headsign ?? item.trip_id}
        meta={[item.trip_id, item.long_name, item.direction_id == null ? null : `Chiều ${item.direction_id}`].filter(Boolean).join(' · ')}
        label={`Chuyến ${item.trip_id}, ${item.headsign ?? ''}, tuyến ${item.short_name ?? item.route_id ?? 'chưa có mã'}`}
        onPress={() => navigation.navigate('TripDetails', { tripId: item.trip_id, title: item.headsign ?? undefined, serviceDate: applied.date || undefined })} />}
    />
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  fields: { gap: spacing.sm, marginBottom: spacing.md },
  searchPanel: { padding: spacing.md, borderRadius: radius.lg },
  appliedPanel: { paddingLeft: spacing.md, borderLeftWidth: 3, marginBottom: spacing.md, gap: spacing.xs },
  appliedLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  disclosure: { minHeight: 52, borderWidth: 1, borderRadius: 12, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disclosureText: { flex: 1, fontSize: 16, fontWeight: '700' },
  summary: { fontSize: 14, lineHeight: 21 },
  resultTitle: { fontSize: 18, fontWeight: '800', marginTop: spacing.sm },
});
