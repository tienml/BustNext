import { useEffect, useMemo, useState } from 'react';
import type { Departure } from '../api/client';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useNextDepartures, useStopDetails } from '../hooks/useTransitQueries';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import { getTransitDateTime, isTransitDate, isTransitTime } from '../utils/transitTime';
import { useScreenActive } from '../hooks/useScreenActive';
import { Button, EmptyState, ErrorState, Icon, LoadingState, Notice, ScreenHeader, SearchField, SectionTitle } from '../components/ui';
import { DepartureCard } from '../components/DepartureCard';
import { TransitMap } from '../components/TransitMap';
import { toMapPoint } from '../components/mapHtml';
import { spacing, useTheme } from '../theme';

export function StopDetailsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'StopDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { stop } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [now, setNow] = useState(() => getTransitDateTime());
  const active = useScreenActive();
  const [live, setLive] = useState(true);
  const [dateInput, setDateInput] = useState(now.date);
  const [timeInput, setTimeInput] = useState(now.time.slice(0, 5));
  const [dateDirty, setDateDirty] = useState(false);
  const [timeDirty, setTimeDirty] = useState(false);
  const [inputError, setInputError] = useState('');
  const [timeControlsOpen, setTimeControlsOpen] = useState(false);
  const draftChanged = dateInput !== now.date || timeInput !== now.time.slice(0, 5);

  function stepDate(days: number) {
    const base = isTransitDate(dateInput) ? dateInput : getTransitDateTime().date;
    const next = new Date(`${base}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    const value = next.toISOString().slice(0, 10);
    if (isTransitDate(value)) { setDateDirty(true); setDateInput(value); setInputError(''); }
  }
  const details = useStopDetails(stop.stop_id);
  const departures = useNextDepartures(stop.stop_id, now.date, now.time, active, live);
  const context = `${stop.stop_id}|${now.date}|${live ? 'live' : now.time}`;
  const [lastResult, setLastResult] = useState<{ context: string; rows: Departure[]; time: string }>();
  useEffect(() => {
    if (departures.data && !departures.isPlaceholderData) {
      setLastResult({ context, rows: departures.data.data, time: now.time });
    }
  }, [context, departures.data, departures.isPlaceholderData, now.time]);
  const showingPrevious = departures.isPlaceholderData || (!departures.data && lastResult?.context === context);
  const rows = departures.data?.data ?? (lastResult?.context === context ? lastResult.rows : []);
  // Keep API order and all returned rows; only the first non-past result is featured.
  const featuredIndex = rows.findIndex((departure) => departure.minutes_until >= 0);

  useEffect(() => {
    if (!active || !live) return;
    setNow(getTransitDateTime());
    const timer = setInterval(() => setNow(getTransitDateTime()), 30_000);
    return () => clearInterval(timer);
  }, [active, live, stop.stop_id]);

  // Keep untouched drafts on the live clock (including midnight/focus return),
  // without overwriting either independently edited field or explicit lookups.
  useEffect(() => {
    if (!live) return;
    if (!dateDirty) setDateInput(now.date);
    if (!timeDirty) setTimeInput(now.time.slice(0, 5));
  }, [live, now.date, now.time, dateDirty, timeDirty]);

  function refreshDepartures() {
    if (live) {
      const fresh = getTransitDateTime();
      setNow(fresh);
      // A same-second tap still needs an actual request.
      if (fresh.date === now.date && fresh.time === now.time) void departures.refetch();
    } else {
      void departures.refetch();
    }
  }

  function applyDateTime() {
    if (!isTransitDate(dateInput) || !isTransitTime(timeInput)) {
      setInputError('Nhập ngày hợp lệ dạng YYYY-MM-DD và giờ từ 00:00 đến 23:59.');
      return;
    }
    setInputError('');
    setLive(false);
    setDateDirty(false);
    setTimeDirty(false);
    const time = `${timeInput}:00`;
    setNow({ date: dateInput, time });
    if (!live && dateInput === now.date && time === now.time) void departures.refetch();
  }
  const currentStop = details.data?.data ?? stop;
  const favorites = useFavorites();
  const saved = favorites.isFavorite('stop', stop.stop_id);
  const [favoriteError, setFavoriteError] = useState('');

  const points = useMemo(() => {
    const point = toMapPoint(currentStop.stop_id, currentStop.lat, currentStop.lon, currentStop.name);
    return point ? [point] : [];
  }, [currentStop.stop_id, currentStop.lat, currentStop.lon, currentStop.name]);

  async function toggleFavorite() {
    setFavoriteError('');
    try {
      await favorites.toggle('stop', stop.stop_id);
    } catch (cause) {
      setFavoriteError(cause instanceof Error ? cause.message : 'Không lưu được trạm.');
    }
  }

  const favoriteButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Bỏ lưu trạm' : 'Lưu trạm'}
      hitSlop={10}
      onPress={() => (auth.user ? void toggleFavorite() : navigation.navigate('MainTabs', { screen: 'Account' }))}
      accessibilityState={{ selected: saved }}
      style={({ pressed }) => [styles.favorite, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.72 : 1 }]}
    >
      <Icon name={saved ? 'heart' : 'heart-outline'} size={22} color={colors.primary} />
    </Pressable>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.list, { paddingBottom: spacing.lg + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}
      keyboardShouldPersistTaps="handled"
      data={rows}
      keyExtractor={(item) => `${item.trip_id}-${item.departure_time}-${item.service_date}`}
      ListHeaderComponent={
        <>
          <ScreenHeader eyebrow="TRẠM XE BUÝT" title={currentStop.name} subtitle={currentStop.code ?? currentStop.stop_id} right={favoriteButton} />
          {!auth.user ? <Notice message="Đăng nhập ở tab Tài khoản để lưu trạm yêu thích." icon="person-circle-outline" /> : null}
          {favoriteError ? <ErrorState message={favoriteError} /> : null}
          {details.isError ? <Notice tone="warning" message="Không tải được thông tin mới nhất của trạm. Đang hiển thị dữ liệu tìm kiếm." /> : null}
          <SectionTitle>Chuyến sắp chạy</SectionTitle>
          <Text style={[styles.updated, { color: colors.muted }]}>{live ? 'Giờ hiện tại · tự cập nhật' : 'Thời điểm đã chọn · thủ công'}: {now.date} · {now.time.slice(0, 5)}</Text>
          <Text style={[styles.updated, { color: colors.muted }]}>Lịch tĩnh GTFS, không phải vị trí xe thời gian thực.</Text>
          {showingPrevious ? <Notice tone="warning" message={`Đang hiển thị lịch đã tải lúc ${lastResult?.time.slice(0, 5) ?? 'trước đó'}. Số phút chờ chưa cập nhật.`} /> : null}
          {departures.isFetching && !departures.isLoading ? <Text accessibilityLiveRegion="polite" style={[styles.updated, { color: colors.muted }]}>Đang cập nhật lịch…</Text> : null}
          {!live ? <Notice message="Số phút chờ được tính từ thời điểm đã chọn, không phải từ hiện tại." /> : null}
          {departures.isError ? <ErrorState message="Không tải được giờ xe. Kiểm tra kết nối rồi thử lại." onRetry={refreshDepartures} /> : null}
          {departures.isLoading ? <LoadingState rows={3} /> : null}
        </>
      }
      ListEmptyComponent={
        departures.isLoading || departures.isError ? null : (
          <EmptyState icon="time-outline" title="Không có chuyến sắp chạy" message="Không có chuyến theo lịch GTFS sau thời điểm tra cứu. Hãy thử ngày hoặc giờ khác." />
        )
      }
      renderItem={({ item, index }) => (
        <>
          {featuredIndex >= 0 && index === featuredIndex + 1 ? <SectionTitle>Các chuyến tiếp theo</SectionTitle> : null}
          <DepartureCard
            departure={item}
            featured={index === featuredIndex}
            live={live}
            stale={showingPrevious || departures.isError}
            referenceDate={now.date}
            referenceTime={showingPrevious && lastResult?.context === context ? lastResult.time : now.time}
            onPress={() => navigation.navigate('TripDetails', { tripId: item.trip_id, title: item.headsign ?? undefined, serviceDate: item.service_date })}
          />
        </>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          <Button label="Làm mới giờ xe" icon="refresh" variant="outline" loading={departures.isFetching && !departures.isLoading} onPress={refreshDepartures} />
          <Text style={[styles.note, { color: colors.muted }]}>Giờ xe theo lịch tĩnh, chưa phải vị trí xe thời gian thực.</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: timeControlsOpen }}
            onPress={() => setTimeControlsOpen((open) => !open)}
            style={({ pressed }) => [styles.disclosure, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.72 : 1 }]}>
            <Text style={[styles.disclosureText, { color: colors.primary }]}>{timeControlsOpen ? 'Thu gọn ngày / giờ' : 'Đổi ngày / giờ tra cứu'}{draftChanged ? ' · Có bản nháp' : ''}</Text>
            <Icon name={timeControlsOpen ? 'chevron-up' : 'chevron-down'} color={colors.primary} />
          </Pressable>
          {timeControlsOpen ? <View style={styles.controls}>
            <Text style={[styles.note, { color: colors.muted }]}>Các thay đổi dưới đây chỉ áp dụng khi bấm Tra cứu.</Text>
            <Text style={{ color: colors.ink }}>Ngày (YYYY-MM-DD)</Text>
            <SearchField accessibilityLabel="Ngày tra cứu, năm-tháng-ngày" icon="calendar-outline" value={dateInput} onChangeText={(value) => { setDateDirty(true); setDateInput(value); }} placeholder="YYYY-MM-DD" autoCorrect={false} autoCapitalize="none" maxLength={10} />
            <View style={styles.shortcuts}>
              <Button label="Ngày trước" variant="ghost" onPress={() => stepDate(-1)} />
              <Button label="Hôm nay" variant="ghost" onPress={() => { setDateDirty(true); setDateInput(getTransitDateTime().date); setInputError(''); }} />
              <Button label="Ngày sau" variant="ghost" onPress={() => stepDate(1)} />
            </View>
            <Text style={{ color: colors.ink }}>Giờ (HH:mm, 24 giờ)</Text>
            <SearchField accessibilityLabel="Giờ tra cứu, giờ:phút" icon="time-outline" value={timeInput} onChangeText={(value) => { setTimeDirty(true); setTimeInput(value); }} placeholder="08:30" autoCorrect={false} maxLength={5} onSubmitEditing={applyDateTime} />
            {inputError ? <ErrorState message={inputError} /> : null}
            <Button label="Tra cứu ngày / giờ đã nhập" onPress={applyDateTime} />
            <Button label={live ? 'Đặt lại về bây giờ' : 'Dùng giờ hiện tại, tự cập nhật'} variant="outline" icon="time-outline" onPress={() => {
              const fresh = getTransitDateTime();
              setInputError(''); setLive(true); setNow(fresh); setDateInput(fresh.date); setTimeInput(fresh.time.slice(0, 5));
              setDateDirty(false); setTimeDirty(false);
              if (live && fresh.date === now.date && fresh.time === now.time) void departures.refetch();
            }} />
            <Text style={[styles.note, { color: colors.muted }]}>Múi giờ Việt Nam (Asia/Ho_Chi_Minh). Giờ sau nửa đêm có thể thuộc ngày dịch vụ trước.</Text>
          </View> : null}
          {points.length > 0 ? <><SectionTitle>Vị trí trạm</SectionTitle><TransitMap points={points} height={180} /></> : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: 32 },
  favorite: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  disclosure: { minHeight: 52, padding: spacing.md, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  disclosureText: { flex: 1, fontSize: 16, fontWeight: '700' },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  controls: { gap: spacing.sm },
  updated: { fontSize: 13, lineHeight: 19, fontWeight: '400', marginBottom: spacing.sm },
  footer: { marginTop: spacing.sm },
  note: { fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});
