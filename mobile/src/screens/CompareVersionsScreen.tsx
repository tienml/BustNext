import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChangedTrip, FieldChange } from '../api/client';
import { useActivateVersion, useComparison, useVersions } from '../hooks/useAdmin';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import { Button, Card, EmptyState, ErrorState, LoadingState, Notice, SectionTitle } from '../components/ui';
import { ChipPicker, confirmAction, Disclosure, versionTitle } from '../components/admin';
import { WorkspaceChange, WorkspaceFact, WorkspaceHeading } from '../components/AdminWorkspaceVisuals';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const versions = useVersions(params.datasetId);
  const options = useMemo(() => (versions.data ?? []).filter((version) => version.dataset_id === params.datasetId && (version.status === 'ready' || version.status === 'active' || version.status === 'archived')), [versions.data, params.datasetId]);
  const selectionKey = `${params.datasetId}:${params.baseVersionId ?? ''}:${params.targetVersionId ?? ''}`;
  const [selection, setSelection] = useState<{ key: string; baseId: number; targetId: number }>();
  const baseId = selection?.key === selectionKey ? selection.baseId : undefined;
  const targetId = selection?.key === selectionKey ? selection.targetId : undefined;
  const setBaseId = (id: number) => setSelection((current) => current?.key === selectionKey ? { ...current, baseId: id } : current);
  const setTargetId = (id: number) => setSelection((current) => current?.key === selectionKey ? { ...current, targetId: id } : current);
  const comparison = useComparison(baseId, targetId);
  const activate = useActivateVersion();
  const [activateError, setActivateError] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Apply valid route IDs once per navigation context, never on a refetch.
  useEffect(() => {
    if (selection?.key === selectionKey || options.length < 2) return;
    const requestedTarget = options.find((version) => version.id === params.targetVersionId);
    const requestedBase = options.find((version) => version.id === params.baseVersionId);
    const base = requestedBase ?? options.find((version) => version.status === 'active' && version.id !== requestedTarget?.id)
      ?? (requestedTarget ? options.find((version) => version.id !== requestedTarget.id)! : options[1]);
    const target = requestedTarget ?? options.find((version) => version.id !== base.id)!;
    setSelection({ key: selectionKey, baseId: base.id, targetId: target.id });
    activate.reset();
    setActivateError('');
  }, [selection?.key, selectionKey, options, params.baseVersionId, params.targetVersionId, activate.reset]);

  const chipOptions = options.map((version) => ({ value: version.id, label: `${versionTitle(version)}${version.status === 'active' ? ' ✓' : ''}` }));
  const target = options.find((version) => version.id === targetId);
  const result = comparison.data;

  async function switchToTarget() {
    if (!target || target.status !== 'ready' || activate.isPending || confirming || !result || baseId === targetId) return;
    setConfirming(true);
    setActivateError('');
    try {
      const refreshed = await versions.refetch();
      if (refreshed.isError) throw refreshed.error;
      const current = refreshed.data?.find((version) => version.id === target.id);
      if (current?.status !== 'ready') throw new Error('Phiên bản đích không còn sẵn sàng. Vui lòng kiểm tra lại.');
      const active = refreshed.data?.find((version) => version.status === 'active');
      const ok = await confirmAction('Chuyển sang phiên bản này?', `${versionTitle(current)} sẽ thay thế ${active ? versionTitle(active) : 'lịch trình hiện tại (chưa có phiên bản đang dùng)'}. Mọi truy vấn mới sẽ dùng phiên bản này.`, 'Kích hoạt');
      if (!ok) return;
      await activate.mutateAsync(current.id);
    } catch (cause) {
      setActivateError(cause instanceof Error ? cause.message : 'Không kích hoạt được.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}>
      <WorkspaceHeading icon="git-compare-outline" label="ĐỐI CHIẾU PHIÊN BẢN" title="Điều gì thay đổi?" description="Đọc từ bản gốc sang bản đích. Phân biệt rõ nội dung thêm, xóa và sửa trước khi chuyển lịch." />
      {versions.isLoading ? <LoadingState rows={2} height={44} /> : null}
      {versions.isError ? <ErrorState message="Không tải được phiên bản." onRetry={() => void versions.refetch()} /> : null}
      {!versions.isLoading && !versions.isError && options.length < 2 ? (
        <EmptyState icon="git-compare-outline" title="Cần ít nhất hai phiên bản hợp lệ" message="Nhập thêm một tệp GTFS để so sánh." />
      ) : null}

      {options.length >= 2 ? (
        <>
          <ChipPicker disabled={confirming || activate.isPending} label="PHIÊN BẢN GỐC" options={chipOptions} value={baseId} onChange={(id) => { setBaseId(id); activate.reset(); setActivateError(''); }} />
          <ChipPicker disabled={confirming || activate.isPending} label="SO VỚI" options={chipOptions} value={targetId} onChange={(id) => { setTargetId(id); activate.reset(); setActivateError(''); }} />
          {baseId === targetId ? <Notice tone="warning" message="Chọn hai phiên bản khác nhau." /> : null}
        </>
      ) : null}

      {comparison.isLoading ? <LoadingState rows={3} height={80} /> : null}
      {comparison.isError ? <ErrorState message={comparison.error instanceof Error ? comparison.error.message : 'Không so sánh được.'} onRetry={() => void comparison.refetch()} /> : null}

      {result ? (
        <>
          <Card style={styles.summary}>
            <Text style={[styles.summaryTitle, { color: colors.ink }]}>{`v${result.base.version_number} → v${result.target.version_number}`}</Text>
            <View>
              <WorkspaceFact icon="add-circle-outline" label="Thêm mới" value={`${result.summary.trips_added} chuyến · ${result.summary.routes_added} tuyến`} tone="primary" />
              <WorkspaceFact icon="remove-circle-outline" label="Đã xóa" value={`${result.summary.trips_removed} chuyến · ${result.summary.routes_removed} tuyến`} tone="danger" />
              <WorkspaceFact icon="create-outline" label="Đã sửa" value={`${result.summary.trips_changed} chuyến · ${result.summary.routes_changed} tuyến`} tone="warning" />
            </View>
            {target?.status === 'archived' ? <Notice tone="warning" message="Phiên bản lưu trữ chỉ dùng để xem và so sánh, không thể kích hoạt lại. Để dùng lịch này, hãy nhập lại tệp GTFS thành phiên bản mới rồi kiểm tra và kích hoạt." /> : null}
            {target?.status === 'ready' ? (
              <Button label={`Chuyển sang ${versionTitle(target)}`} icon="swap-horizontal" loading={confirming || activate.isPending} onPress={() => void switchToTarget()} />
            ) : null}
            {activate.isSuccess ? <Notice message="Đã chuyển phiên bản thành công. Chạy lại các truy vấn mẫu để kiểm tra lịch mới." /> : null}
            {activate.isSuccess ? <Button label="Chạy lại truy vấn mẫu" icon="play-outline" variant="outline" onPress={() => navigation.navigate('SavedQueries', { datasetId: params.datasetId })} /> : null}
            {activateError ? <ErrorState message={activateError} /> : null}
          </Card>

          {Object.values(result.summary).every((count) => count === 0) ? (
            <EmptyState icon="checkmark-done-outline" title="Hai phiên bản giống nhau" message="Không có khác biệt về tuyến, chuyến và giờ dừng." />
          ) : null}

          {result.by_route.length ? <SectionTitle>Theo tuyến</SectionTitle> : null}
          {result.by_route.map((group) => (
            <Disclosure key={`${baseId}-${targetId}-${group.route_id}`} title={`Tuyến ${group.route_id}`} summary={`${group.trips_added.length} chuyến mới · ${group.trips_removed.length} xóa · ${group.trips_changed.length} thay đổi`}>
              <Card style={styles.group}>
                <TripLine label="+ Thêm" tone="primary" ids={group.trips_added} />
                <TripLine label="− Xóa" tone="danger" ids={group.trips_removed} />
                <TripLine label="~ Sửa" tone="warning" ids={group.trips_changed} />
              </Card>
            </Disclosure>
          ))}

          {result.routes.changed.length || result.routes.added.length || result.routes.removed.length ? <SectionTitle>Thay đổi tuyến</SectionTitle> : null}
          <Disclosure key={`routes-${baseId}-${targetId}`} title="Thay đổi thông tin tuyến" summary={`${result.routes.added.length} thêm · ${result.routes.removed.length} xóa · ${result.routes.changed.length} thay đổi`}>
          {result.routes.added.map((route) => <Line key={`ra-${route.route_id}`} tone="primary" text={`+ ${route.route_id} ${route.long_name ?? ''}`} />)}
          {result.routes.removed.map((route) => <Line key={`rr-${route.route_id}`} tone="danger" text={`− ${route.route_id} ${route.long_name ?? ''}`} />)}
          {result.routes.changed.map((route) => (
            <Line key={`rc-${route.route_id}`} tone="warning" text={`${route.route_id}: ${route.changes.map(describeField).join('; ')}`} />
          ))}

          </Disclosure>
          {result.trips.changed.length ? <SectionTitle>Chi tiết chuyến thay đổi</SectionTitle> : null}
          {result.trips.changed.map((trip) => (
            <Disclosure key={`${baseId}-${targetId}-${trip.trip_id}`} title={`Chuyến ${trip.trip_id}${trip.route_id ? ` · tuyến ${trip.route_id}` : ''}`} summary={`${trip.changes.length} thay đổi thông tin · ${trip.stop_times.length} thay đổi điểm dừng`}>
              <ChangedTripCard trip={trip} />
            </Disclosure>
          ))}
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
        <WorkspaceChange key={change.field} label={FIELD_LABELS[change.field] ?? change.field} before={String(change.from ?? '—')} after={String(change.to ?? '—')} />
      ))}
      {trip.stop_times.map((stopTime) => (
        <View key={stopTime.stop_sequence} style={[styles.stopRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.seq, { color: colors.muted }]}>#{stopTime.stop_sequence}</Text>
          <View style={styles.stopBody}>
            <Text style={[styles.stopKind, { color: colors.warning }]}>{STOP_CHANGE_LABELS[stopTime.type] ?? stopTime.type}</Text>
            <WorkspaceChange label="Trạm" before={stopTime.from?.stop_id ?? '—'} after={stopTime.to?.stop_id ?? '—'} />
            <WorkspaceChange label="Giờ đến" before={stopTime.from?.arrival_time ?? '—'} after={stopTime.to?.arrival_time ?? '—'} />
            <WorkspaceChange label="Giờ đi" before={stopTime.from?.departure_time ?? '—'} after={stopTime.to?.departure_time ?? '—'} />
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  summary: { gap: spacing.sm, marginTop: spacing.sm, shadowOpacity: 0, elevation: 0 },
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
