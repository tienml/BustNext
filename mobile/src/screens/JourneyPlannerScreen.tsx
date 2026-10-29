import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStopSearch } from '../hooks/useTransitQueries';
import { useJourneyPlan } from '../hooks/useJourneyPlan';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import { formatGtfsTime, getTransitDateTime } from '../utils/transitTime';
import type { Stop } from '../api/client';
import { Badge, Card, EmptyState, ErrorState, Icon, ListRow, LoadingState, Notice, ScreenHeader, SearchField, SectionTitle } from '../components/ui';

type Target = 'from' | 'to';

export function JourneyPlannerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [from, setFrom] = useState<Stop | null>(null);
  const [to, setTo] = useState<Stop | null>(null);
  const [focused, setFocused] = useState<Target>('from');
  const [transitNow, setTransitNow] = useState(getTransitDateTime());
  const fromResults = useStopSearch(fromQuery);
  const toResults = useStopSearch(toQuery);
  const plan = useJourneyPlan(from?.stop_id ?? '', to?.stop_id ?? '', transitNow.date, transitNow.time);

  useEffect(() => {
    const timer = setInterval(() => setTransitNow(getTransitDateTime()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function selectStop(stop: Stop, target: Target) {
    if (target === 'from') {
      setFrom(stop);
      setFromQuery(stop.name);
      if (!to) setFocused('to');
    } else {
      setTo(stop);
      setToQuery(stop.name);
    }
  }

  function swap() {
    setFrom(to);
    setTo(from);
    setFromQuery(toQuery);
    setToQuery(fromQuery);
  }

  const activeQuery = focused === 'from' ? fromQuery : toQuery;
  const activeSelected = focused === 'from' ? from : to;
  const activeResults = focused === 'from' ? fromResults : toResults;
  const results = activeResults.data?.data ?? [];
  const showSuggestions = !activeSelected && activeQuery.trim().length > 1;
  const sameStop = Boolean(from && to && from.stop_id === to.stop_id);
  const ready = Boolean(from && to && !sameStop);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={ready ? plan.data?.data ?? [] : []}
        keyExtractor={(item, index) => `${item.legs[0]?.trip_id}-${index}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <ScreenHeader
              eyebrow="TÌM ĐƯỜNG"
              title="Đi bằng xe buýt"
              subtitle="Chọn hai trạm để tìm chuyến đi thẳng hoặc chuyển tuyến một lần theo lịch GTFS."
            />
            <Card style={styles.form}>
              <View style={styles.fieldRow}>
                <Icon name="radio-button-on" size={18} color={colors.primary} />
                <View style={styles.fieldBody}>
                  <SearchField
                    accessibilityLabel="Điểm đi"
                    placeholder="Chọn trạm xuất phát"
                    value={fromQuery}
                    onFocus={() => setFocused('from')}
                    onChangeText={(value) => { setFromQuery(value); setFrom(null); setFocused('from'); }}
                  />
                </View>
              </View>
              <View style={styles.fieldRow}>
                <Icon name="location" size={18} color={colors.secondary} />
                <View style={styles.fieldBody}>
                  <SearchField
                    accessibilityLabel="Điểm đến"
                    placeholder="Chọn trạm đến"
                    value={toQuery}
                    onFocus={() => setFocused('to')}
                    onChangeText={(value) => { setToQuery(value); setTo(null); setFocused('to'); }}
                  />
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đổi điểm đi và điểm đến"
                onPress={swap}
                hitSlop={8}
                style={({ pressed }) => [styles.swap, { backgroundColor: colors.primarySoft }, pressed && styles.pressed]}
              >
                <Icon name="swap-vertical" size={18} color={colors.primary} />
                <Text style={[styles.swapText, { color: colors.primary }]}>Đổi chiều</Text>
              </Pressable>
            </Card>

            {showSuggestions ? (
              <View style={styles.block}>
                <SectionTitle>{focused === 'from' ? 'Chọn điểm đi' : 'Chọn điểm đến'}</SectionTitle>
                {activeResults.isFetching && results.length === 0 ? <LoadingState rows={2} height={58} /> : null}
                {activeResults.isError ? <ErrorState message="Không tải được danh sách trạm." onRetry={() => activeResults.refetch()} /> : null}
                {!activeResults.isFetching && !activeResults.isError && results.length === 0 ? (
                  <Notice message="Không tìm thấy trạm phù hợp." />
                ) : null}
                {results.slice(0, 6).map((stop) => (
                  <ListRow
                    key={stop.stop_id}
                    leading={<Badge icon="location-outline" />}
                    title={stop.name}
                    meta={stop.code ?? stop.stop_id}
                    accessibilityLabel={`Chọn trạm ${stop.name}`}
                    onPress={() => selectStop(stop, focused)}
                  />
                ))}
              </View>
            ) : null}

            {sameStop ? <Notice tone="warning" message="Điểm đi và điểm đến đang là cùng một trạm." /> : null}
            {ready ? (
              <View style={styles.block}>
                <SectionTitle right={<Text style={[styles.clock, { color: colors.muted }]}>{transitNow.date} · {formatGtfsTime(transitNow.time)}</Text>}>
                  Phương án phù hợp
                </SectionTitle>
                {plan.isFetching && !plan.data ? <LoadingState rows={2} height={130} /> : null}
                {plan.isError ? <ErrorState message="Không tìm được phương án. Kiểm tra kết nối hoặc thử trạm khác." onRetry={() => plan.refetch()} /> : null}
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          ready && !plan.isFetching && !plan.isError ? (
            <EmptyState icon="git-branch-outline" title="Không có chuyến phù hợp" message="Không có chuyến đi thẳng hoặc chuyển một lần trong thời gian tới." />
          ) : !from && !to && !showSuggestions ? (
            <EmptyState icon="navigate-outline" title="Chọn điểm đi và điểm đến" message="Gõ tên hoặc mã trạm, rồi chọn trong danh sách gợi ý." />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.journey}>
            <View style={styles.journeyHeader}>
              <Text style={[styles.journeyTime, { color: colors.ink }]}>
                {formatGtfsTime(item.departure_time)} → {formatGtfsTime(item.arrival_time)}
              </Text>
              <View style={[styles.duration, { backgroundColor: colors.primarySoft }]}>
                <Icon name="time-outline" size={14} color={colors.primary} />
                <Text style={[styles.durationText, { color: colors.primary }]}>{item.duration_minutes} phút</Text>
              </View>
            </View>
            <Text style={[styles.transfer, { color: colors.muted }]}>
              {item.transfers === 0 ? 'Đi thẳng' : `${item.transfers} lần chuyển tuyến`}
              {item.service_date ? ` · ngày dịch vụ ${item.service_date}` : ''}
            </Text>
            {item.legs.map((leg, index) => (
              <View key={`${leg.trip_id}-${index}`}>
                {index > 0 ? (
                  <View style={styles.transferRow}>
                    <Icon name="walk-outline" size={16} color={colors.warning} />
                    <Text style={[styles.transferText, { color: colors.warning }]}>Chuyển tuyến tại {leg.from.stop_name ?? leg.from.stop_id}</Text>
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xem chuyến tuyến ${leg.route_short_name ?? leg.route_id}`}
                  onPress={() => navigation.navigate('TripDetails', { tripId: leg.trip_id, title: leg.headsign ?? undefined })}
                  style={({ pressed }) => [styles.leg, { borderTopColor: colors.border }, pressed && styles.pressed]}
                >
                  <Badge label={leg.route_short_name ?? leg.route_id} tone="secondary" />
                  <View style={styles.legBody}>
                    <Text style={[styles.legTitle, { color: colors.ink }]} numberOfLines={1}>{leg.headsign ?? 'Theo lịch tuyến'}</Text>
                    <Text style={[styles.legMeta, { color: colors.muted }]} numberOfLines={2}>
                      {formatGtfsTime(leg.from.departure_time)} {leg.from.stop_name ?? leg.from.stop_id} → {formatGtfsTime(leg.to.arrival_time)} {leg.to.stop_name ?? leg.to.stop_id}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={20} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 32 },
  form: { padding: spacing.md, gap: spacing.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fieldBody: { flex: 1 },
  swap: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 6, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  swapText: { fontWeight: '800', fontSize: 13 },
  pressed: { opacity: 0.72 },
  block: { marginTop: spacing.md },
  clock: { fontSize: 12, fontWeight: '700' },
  journey: { padding: spacing.md, marginBottom: spacing.sm },
  journeyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  journeyTime: { fontWeight: '800', fontSize: 17 },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  durationText: { fontWeight: '800', fontSize: 12 },
  transfer: { fontSize: 12, marginTop: 5, marginBottom: 4 },
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  transferText: { fontSize: 12, fontWeight: '700' },
  leg: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legBody: { flex: 1 },
  legTitle: { fontWeight: '700' },
  legMeta: { fontSize: 12, marginTop: 3, lineHeight: 17 },
});
