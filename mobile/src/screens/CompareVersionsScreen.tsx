import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import type { ChangedTrip, FieldChange } from '../api/client';
import { useActivateVersion, useComparison, useVersions } from '../hooks/useAdmin';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import { Button, Card, EmptyState, ErrorState, LoadingState, Notice, SectionTitle } from '../components/ui';
import { ChipPicker, confirmAction, Stat, versionTitle } from '../components/admin';

const FIELD_LABELS: Record<string, string> = {
  route_id: 'Tuyến', service_id: 'Lịch chạy', headsign: 'Hướng', direction_id: 'Chiều',
  short_name: 'Số tuyến', long_name: 'Tên tuyến', route_type: 'Loại',
};

const STOP_CHANGE_LABELS: Record<string, string> = {
  time_changed: 'Đổi giờ', stop_changed: 'Đổi trạm', stop_added: 'Thêm điểm dừng', stop_removed: 'Bỏ điểm dừng',
};

function describeField(change: FieldChange) {
  return `${FIELD_LABELS[change.field] ?? change.field}: ${String(change.from ?? '—')} → ${String(change.to ?? '—')}`;
}

export function CompareVersionsScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'CompareVersions'>>();
  const { colors } = useTheme();
  const versions = useVersions(params.datasetId);
  const options = useMemo(() => (versions.data ?? []).filter((version) => version.status !== 'failed' && version.status !== 'pending' && version.status !== 'validating'), [versions.data]);
  const [baseId, setBaseId] = useState<number>();
  const [targetId, setTargetId] = useState<number>();
  const comparison = useComparison(baseId, targetId);
  const activate = useActivateVersion();
  const [activateError, setActivateError] = useState('');

  // Default: compare the active version with the newest one that isn't active.
  useEffect(() => {
    if (baseId !== undefined || options.length < 2) return;
    const active = options.find((version) => version.status === 'active') ?? options[1];
    const candidate = options.find((version) => version.id !== active.id);
    setBaseId(active.id);
    setTargetId(candidate?.id);
  }, [baseId, options]);

  const chipOptions = options.map((version) => ({ value: version.id, label: `${versionTitle(version)}${version.status === 'active' ? ' ✓' : ''}` }));
  const target = options.find((version) => version.id === targetId);
  const result = comparison.data;

  async function switchToTarget() {
    if (!target) return;
    const ok = await confirmAction('Chuyển sang phiên bản này?', `${versionTitle(target)} sẽ trở thành lịch đang dùng.`, 'Chuyển');
    if (!ok) return;
    setActivateError('');
    try {
      await activate.mutateAsync(target.id);
    } catch (cause) {
      setActivateError(cause instanceof Error ? cause.message : 'Không kích hoạt được.');
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {versions.isLoading ? <LoadingState rows={2} height={44} /> : null}
      {versions.isError ? <ErrorState message="Không tải được phiên bản." onRetry={() => void versions.refetch()} /> : null}
      {!versions.isLoading && options.length < 2 ? (
        <EmptyState icon="git-compare-outline" title="Cần ít nhất hai phiên bản hợp lệ" message="Nhập thêm một tệp GTFS để so sánh." />
      ) : null}

      {options.length >= 2 ? (
        <>
          <ChipPicker label="PHIÊN BẢN GỐC" options={chipOptions} value={baseId} onChange={setBaseId} />
          <ChipPicker label="SO VỚI" options={chipOptions} value={targetId} onChange={setTargetId} />
          {baseId === targetId ? <Notice tone="warning" message="Chọn hai phiên bản khác nhau." /> : null}
        </>
      ) : null}

      {comparison.isLoading ? <LoadingState rows={3} height={80} /> : null}
      {comparison.isError ? <ErrorState message={comparison.error instanceof Error ? comparison.error.message : 'Không so sánh được.'} onRetry={() => void comparison.refetch()} /> : null}

      {result ? (
        <>
          <Card style={styles.summary}>
            <Text style={[styles.summaryTitle, { color: colors.ink }]}>{`v${result.base.version_number} → v${result.target.version_number}`}</Text>
            <View style={styles.stats}>
              <Stat label="Chuyến mới" value={result.summary.trips_added} tone={result.summary.trips_added ? 'primary' : 'ink'} />
              <Stat label="Chuyến bị xóa" value={result.summary.trips_removed} tone={result.summary.trips_removed ? 'danger' : 'ink'} />
              <Stat label="Chuyến đổi giờ/thông tin" value={result.summary.trips_changed} tone={result.summary.trips_changed ? 'warning' : 'ink'} />
              <Stat label="Tuyến mới" value={result.summary.routes_added} />
              <Stat label="Tuyến bị xóa" value={result.summary.routes_removed} />
              <Stat label="Tuyến thay đổi" value={result.summary.routes_changed} />
            </View>
            {target && target.status !== 'active' ? (
              <Button label={`Chuyển sang ${versionTitle(target)}`} icon="swap-horizontal" loading={activate.isPending} onPress={() => void switchToTarget()} />
            ) : null}
            {activate.isSuccess ? <Notice message="Đã chuyển phiên bản. Hãy chạy lại các truy vấn mẫu để kiểm tra." /> : null}
            {activateError ? <ErrorState message={activateError} /> : null}
          </Card>

          {Object.values(result.summary).every((count) => count === 0) ? (
            <EmptyState icon="checkmark-done-outline" title="Hai phiên bản giống nhau" message="Không có khác biệt về tuyến, chuyến và giờ dừng." />
          ) : null}

          {result.by_route.length ? <SectionTitle>Theo tuyến</SectionTitle> : null}
          {result.by_route.map((group) => (
            <Card key={group.route_id} style={styles.group}>
              <Text style={[styles.groupTitle, { color: colors.ink }]}>Tuyến {group.route_id}</Text>
              <TripLine label="Mới" tone="primary" ids={group.trips_added} />
              <TripLine label="Xóa" tone="danger" ids={group.trips_removed} />
              <TripLine label="Đổi" tone="warning" ids={group.trips_changed} />
            </Card>
          ))}

          {result.routes.changed.length || result.routes.added.length || result.routes.removed.length ? <SectionTitle>Thay đổi tuyến</SectionTitle> : null}
          {result.routes.added.map((route) => <Line key={`ra-${route.route_id}`} tone="primary" text={`+ ${route.route_id} ${route.long_name ?? ''}`} />)}
          {result.routes.removed.map((route) => <Line key={`rr-${route.route_id}`} tone="danger" text={`− ${route.route_id} ${route.long_name ?? ''}`} />)}
          {result.routes.changed.map((route) => (
            <Line key={`rc-${route.route_id}`} tone="warning" text={`${route.route_id}: ${route.changes.map(describeField).join('; ')}`} />
          ))}

          {result.trips.changed.length ? <SectionTitle>Chi tiết chuyến thay đổi</SectionTitle> : null}
          {result.trips.changed.map((trip) => <ChangedTripCard key={trip.trip_id} trip={trip} />)}
        </>
      ) : null}
    </ScrollView>
  );
}

function TripLine({ label, ids, tone }: { label: string; ids: string[]; tone: 'primary' | 'danger' | 'warning' }) {
  const { colors } = useTheme();
  if (!ids.length) return null;
  const color = { primary: colors.primary, danger: colors.danger, warning: colors.warning }[tone];
  return (
    <Text style={[styles.tripLine, { color: colors.ink }]}>
      <Text style={{ color, fontWeight: '800' }}>{label} ({ids.length}): </Text>
      {ids.join(', ')}
    </Text>
  );
}

function Line({ text, tone }: { text: string; tone: 'primary' | 'danger' | 'warning' }) {
  const { colors } = useTheme();
  const color = { primary: colors.primary, danger: colors.danger, warning: colors.warning }[tone];
  return <Text style={[styles.line, { color, borderColor: colors.border, backgroundColor: colors.surface }]}>{text}</Text>;
}

function ChangedTripCard({ trip }: { trip: ChangedTrip }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.ink }]}>Chuyến {trip.trip_id}{trip.route_id ? ` · tuyến ${trip.route_id}` : ''}</Text>
      {trip.changes.map((change) => (
        <Text key={change.field} style={[styles.tripLine, { color: colors.ink }]}>{describeField(change)}</Text>
      ))}
      {trip.stop_times.map((stopTime) => (
        <View key={stopTime.stop_sequence} style={[styles.stopRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.seq, { color: colors.muted }]}>#{stopTime.stop_sequence}</Text>
          <View style={styles.stopBody}>
            <Text style={[styles.stopKind, { color: colors.warning }]}>{STOP_CHANGE_LABELS[stopTime.type] ?? stopTime.type}</Text>
            <Text style={[styles.tripLine, { color: colors.ink }]}>
              {stopTime.from ? `${stopTime.from.stop_id} ${stopTime.from.arrival_time}/${stopTime.from.departure_time}` : '—'}
              {'  →  '}
              {stopTime.to ? `${stopTime.to.stop_id} ${stopTime.to.arrival_time}/${stopTime.to.departure_time}` : '—'}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  summary: { gap: spacing.sm, marginTop: spacing.sm },
  summaryTitle: { fontSize: 18, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { gap: 6, marginBottom: spacing.sm },
  groupTitle: { fontSize: 15, fontWeight: '800' },
  tripLine: { fontSize: 13, lineHeight: 19 },
  line: { fontSize: 13, lineHeight: 19, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, padding: 10, marginBottom: 6, fontWeight: '600' },
  stopRow: { flexDirection: 'row', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  seq: { fontSize: 12, fontWeight: '800', width: 28 },
  stopBody: { flex: 1 },
  stopKind: { fontSize: 12, fontWeight: '800' },
});
