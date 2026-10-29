import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStopSearch } from '../hooks/useTransitQueries';
import { useJourneyPlan } from '../hooks/useJourneyPlan';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';
import { formatGtfsTime, getTransitDateTime } from '../utils/transitTime';
import type { Stop } from '../api/client';

export function JourneyPlannerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [from, setFrom] = useState<Stop | null>(null);
  const [to, setTo] = useState<Stop | null>(null);
  const [transitNow, setTransitNow] = useState(getTransitDateTime());
  const fromResults = useStopSearch(fromQuery);
  const toResults = useStopSearch(toQuery);
  const plan = useJourneyPlan(from?.stop_id ?? '', to?.stop_id ?? '', transitNow.date, transitNow.time);

  useEffect(() => {
    const timer = setInterval(() => setTransitNow(getTransitDateTime()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function selectStop(stop: Stop, target: 'from' | 'to') {
    if (target === 'from') {
      setFrom(stop);
      setFromQuery(stop.name);
    } else {
      setTo(stop);
      setToQuery(stop.name);
    }
  }

  const activeTarget = !from ? 'from' : 'to';
  const activeQuery = activeTarget === 'from' ? fromQuery : toQuery;
  const activeResults = activeTarget === 'from' ? fromResults : toResults;
  const results = activeResults.data?.data ?? [];
  const showSuggestions = (!from || !to) && activeQuery.trim().length > 1 && !activeResults.isFetching && results.length > 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={plan.data?.data ?? []}
        keyExtractor={(item, index) => `${item.legs[0]?.trip_id}-${index}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>TÌM ĐƯỜNG</Text>
            <Text style={styles.title}>Đi bằng xe buýt</Text>
            <Text style={styles.subtitle}>Chọn hai trạm để tìm chuyến trực tiếp hoặc một lần chuyển tuyến theo lịch GTFS.</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ĐIỂM ĐI</Text>
              <TextInput accessibilityLabel="Điểm đi" value={fromQuery} onChangeText={(value) => { setFromQuery(value); setFrom(null); }} placeholder="Chọn trạm xuất phát" placeholderTextColor={colors.muted} style={styles.input} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ĐIỂM ĐẾN</Text>
              <TextInput accessibilityLabel="Điểm đến" value={toQuery} onChangeText={(value) => { setToQuery(value); setTo(null); }} placeholder="Chọn trạm đến" placeholderTextColor={colors.muted} style={styles.input} />
            </View>
            {showSuggestions ? (
              <View style={styles.suggestions}>
                <Text style={styles.suggestionTitle}>Chọn {activeTarget === 'from' ? 'điểm đi' : 'điểm đến'}</Text>
                {results.slice(0, 6).map((stop) => (
                  <Pressable key={stop.stop_id} onPress={() => selectStop(stop, activeTarget)} style={styles.suggestionRow} accessibilityRole="button" accessibilityLabel={`Chọn trạm ${stop.name}`}>
                    <Text style={styles.suggestionName}>{stop.name}</Text>
                    <Text style={styles.suggestionCode}>{stop.code ?? stop.stop_id}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {from && to ? <Text style={styles.ready}>Đã chọn: {from.name} → {to.name}</Text> : null}
            {plan.isFetching ? <View style={styles.skeleton} accessibilityLiveRegion="polite" /> : null}
            {plan.isError ? <Text style={styles.error} accessibilityLiveRegion="polite">Không tìm được phương án. Kiểm tra dữ liệu lịch hoặc thử trạm khác.</Text> : null}
            {from && to && !plan.isFetching ? <Text style={styles.sectionTitle}>Phương án phù hợp</Text> : null}
          </>
        }
        ListEmptyComponent={from && to && !plan.isFetching ? <Text style={styles.muted}>Không có chuyến phù hợp trong thời gian hiện tại.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.journeyCard}>
            <View style={styles.journeyHeader}>
              <Text style={styles.journeyTime}>{formatGtfsTime(item.departure_time)} → {formatGtfsTime(item.arrival_time)}</Text>
              <Text style={styles.duration}>{item.duration_minutes} phút</Text>
            </View>
            <Text style={styles.transfer}>{item.transfers === 0 ? 'Đi thẳng' : `${item.transfers} lần chuyển tuyến`}{item.service_date ? ` · ngày dịch vụ ${item.service_date}` : ''}</Text>
            {item.legs.map((leg, index) => (
              <Pressable key={`${leg.trip_id}-${index}`} onPress={() => navigation.navigate('TripDetails', { tripId: leg.trip_id, title: leg.headsign ?? undefined })} style={styles.leg} accessibilityRole="button" accessibilityLabel={`Xem chuyến ${leg.route_short_name ?? leg.route_id}`}>
                <View style={styles.routeBadge}><Text style={styles.route}>{leg.route_short_name ?? leg.route_id}</Text></View>
                <View style={styles.legBody}><Text style={styles.legTitle}>{leg.headsign ?? 'Theo lịch tuyến'}</Text><Text style={styles.legMeta}>{leg.from.stop_name} → {leg.to.stop_name}</Text></View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 28 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  inputGroup: { marginBottom: 12 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, minHeight: 52, paddingHorizontal: 16, fontSize: 16, color: colors.ink },
  suggestions: { backgroundColor: colors.surface, borderRadius: 15, padding: 8, marginBottom: 12, shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  suggestionTitle: { color: colors.primary, fontWeight: '800', padding: 8 },
  suggestionRow: { borderTopColor: colors.border, borderTopWidth: 1, padding: 11 },
  suggestionName: { color: colors.ink, fontWeight: '700' },
  suggestionCode: { color: colors.muted, fontSize: 12, marginTop: 3 },
  ready: { color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 12, padding: 12, marginBottom: 10, fontWeight: '700' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  journeyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 7, elevation: 2 },
  journeyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  journeyTime: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  duration: { color: colors.primary, fontWeight: '800' },
  transfer: { color: colors.muted, fontSize: 12, marginTop: 5, marginBottom: 10 },
  leg: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  routeBadge: { backgroundColor: colors.primarySoft, borderRadius: 9, minWidth: 44, minHeight: 38, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  route: { color: colors.primary, fontWeight: '800' },
  legBody: { flex: 1 },
  legTitle: { color: colors.ink, fontWeight: '700' },
  legMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  chevron: { color: colors.primary, fontSize: 26 },
  error: { backgroundColor: colors.dangerSurface, color: colors.danger, borderRadius: 12, padding: 12, marginTop: 8 },
  muted: { color: colors.muted, textAlign: 'center', marginTop: 20 },
  skeleton: { height: 120, backgroundColor: '#E6E8F0', borderRadius: 16, marginTop: 10 },
});
