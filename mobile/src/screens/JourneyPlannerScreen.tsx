import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStopSearch } from '../hooks/useTransitQueries';
import { useJourneyPlan } from '../hooks/useJourneyPlan';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import { formatGtfsTime, getTransitDateTime } from '../utils/transitTime';
import { getLegServiceDate } from '../utils/journeySchedule';
import type { Stop } from '../api/client';
import { Badge, Card, EmptyState, ErrorState, Icon, ListRow, LoadingState, Notice, ScreenHeader, SearchField, SectionTitle } from '../components/ui';
import { JourneyItineraryCard } from '../components/JourneyItineraryCard';
import { TransitEmptyState } from '../components/TransitIllustration';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Target = 'from' | 'to';

export function JourneyPlannerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
        contentContainerStyle={[styles.list, { paddingBottom: 32 + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <ScreenHeader
              eyebrow="TÌM ĐƯỜNG"
              title="Đi bằng xe buýt"
              subtitle="Hai điểm dừng. Một hành trình rõ ràng. Tìm chuyến đi thẳng hoặc chuyển tuyến một lần."
            />
            <Card style={styles.form}>
              <View style={styles.formHeading}>
                <Text style={[styles.formTitle, { color: colors.ink }]}>Bạn muốn đến đâu?</Text>
                <Text style={[styles.formHint, { color: colors.muted }]}>Chọn trạm trong danh sách gợi ý</Text>
              </View>
              <View style={styles.fieldRow}>
                <View style={styles.fieldTrack}>
                  <Icon name="radio-button-on" size={18} color={colors.primary} />
                  <View style={[styles.fieldConnection, { backgroundColor: colors.border }]} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={[styles.fieldLabel, { color: colors.primary }]}>ĐIỂM ĐI</Text>
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
                <View style={styles.fieldTrack}><Icon name="location" size={18} color={colors.secondary} /></View>
                <View style={styles.fieldBody}>
                  <Text style={[styles.fieldLabel, { color: colors.secondary }]}>ĐIỂM ĐẾN</Text>
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
                <SectionTitle>Phương án hành trình</SectionTitle>
                <Text style={[styles.clock, { color: colors.muted }]}>Theo lịch GTFS · {transitNow.date} · Từ {formatGtfsTime(transitNow.time)}</Text>
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
            <TransitEmptyState variant="search" title="Bắt đầu từ một điểm dừng" message="Gõ tên hoặc mã trạm rồi chọn điểm đi, điểm đến. Lộ trình và giờ xe sẽ xuất hiện tại đây." />
          ) : null
        }
        renderItem={({ item }) => (
          <JourneyItineraryCard
            journey={item}
            onOpenLeg={(leg) => navigation.navigate('TripDetails', { tripId: leg.trip_id, title: leg.headsign ?? undefined, serviceDate: getLegServiceDate(leg) })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 32 },
  form: { padding: spacing.md, gap: spacing.md, shadowOpacity: 0, elevation: 0 },
  formHeading: { gap: 4, marginBottom: 4 },
  formTitle: { fontSize: 18, lineHeight: 26, fontWeight: '800' },
  formHint: { fontSize: 13, lineHeight: 20 },
  fieldRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  fieldTrack: { width: 20, alignItems: 'center', paddingTop: 33 },
  fieldConnection: { width: 2, flex: 1, marginTop: 6, marginBottom: -44 },
  fieldLabel: { fontSize: 11, lineHeight: 18, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  fieldBody: { flex: 1, minWidth: 0 },
  swap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', minHeight: 48, gap: 6, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  swapText: { fontWeight: '800', fontSize: 13 },
  pressed: { opacity: 0.72 },
  block: { marginTop: spacing.md },
  clock: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
});
