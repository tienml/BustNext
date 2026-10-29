import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import type { SavedQuery, SavedQueryRun, SavedQueryType } from '../api/client';
import { useCreateSavedQuery, useDeleteSavedQuery, useRunSavedQueries, useSavedQueries } from '../hooks/useAdmin';
import type { RootStackParamList } from '../navigation/types';
import { getTransitDateTime } from '../utils/transitTime';
import { radius, spacing, useTheme } from '../theme';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, Notice, SearchField, SectionTitle } from '../components/ui';
import { ChipPicker, confirmAction, formatDateTime } from '../components/admin';

type Field = { key: string; label: string; placeholder: string; required?: boolean };

const TYPES: Record<SavedQueryType, { label: string; fields: Field[] }> = {
  departures: {
    label: 'Chuyến kế tiếp',
    fields: [
      { key: 'stop_id', label: 'Mã trạm', placeholder: 'S20', required: true },
      { key: 'date', label: 'Ngày (YYYY-MM-DD)', placeholder: 'Bỏ trống = hôm nay' },
      { key: 'time', label: 'Giờ (HH:MM:SS)', placeholder: 'Bỏ trống = bây giờ' },
      { key: 'limit', label: 'Số chuyến', placeholder: '5' },
    ],
  },
  route_trips: {
    label: 'Chuyến của tuyến',
    fields: [
      { key: 'route_id', label: 'Mã tuyến', placeholder: 'R5', required: true },
      { key: 'date', label: 'Ngày (YYYY-MM-DD)', placeholder: 'Bỏ trống = hôm nay' },
    ],
  },
  trip: { label: 'Giờ dừng của chuyến', fields: [{ key: 'trip_id', label: 'Mã chuyến', placeholder: 'T050', required: true }] },
  stops: { label: 'Tìm trạm', fields: [{ key: 'q', label: 'Tên hoặc mã trạm', placeholder: 'Bến Thành', required: true }] },
  routes: { label: 'Tìm tuyến', fields: [{ key: 'q', label: 'Số hoặc tên tuyến', placeholder: '5', required: true }] },
  journey: {
    label: 'Tìm đường',
    fields: [
      { key: 'from_stop_id', label: 'Trạm đi', placeholder: 'S10', required: true },
      { key: 'to_stop_id', label: 'Trạm đến', placeholder: 'S22', required: true },
      { key: 'date', label: 'Ngày (YYYY-MM-DD)', placeholder: '2026-10-28', required: true },
      { key: 'time', label: 'Giờ (HH:MM:SS)', placeholder: '07:00:00', required: true },
    ],
  },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{1,2}:\d{2}:\d{2}$/;

function describeParams(query: Pick<SavedQuery, 'params'>) {
  return Object.entries(query.params).map(([key, value]) => `${key}=${value}`).join(' · ');
}

export function SavedQueriesScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'SavedQueries'>>();
  const { colors } = useTheme();
  const queries = useSavedQueries(params.datasetId);
  const create = useCreateSavedQuery(params.datasetId);
  const remove = useDeleteSavedQuery(params.datasetId);
  const runner = useRunSavedQueries(params.datasetId);
  const [type, setType] = useState<SavedQueryType>('departures');
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [runs, setRuns] = useState<Record<number, SavedQueryRun>>({});
  const [runError, setRunError] = useState('');

  const typeOptions = useMemo(() => (Object.keys(TYPES) as SavedQueryType[]).map((value) => ({ value, label: TYPES[value].label })), []);

  async function save() {
    setFormError('');
    const fields = TYPES[type].fields;
    const payload: Record<string, string | number> = {};
    for (const field of fields) {
      const value = (values[field.key] ?? '').trim();
      if (!value) {
        if (field.required) return setFormError(`Thiếu “${field.label}”.`);
        continue;
      }
      if (field.key === 'date' && !DATE.test(value)) return setFormError('Ngày phải có dạng YYYY-MM-DD.');
      if (field.key === 'time' && !TIME.test(value)) return setFormError('Giờ phải có dạng HH:MM:SS, ví dụ 25:10:00.');
      if (field.key === 'limit') {
        const limit = Number(value);
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) return setFormError('Số chuyến từ 1 đến 50.');
        payload[field.key] = limit;
        continue;
      }
      payload[field.key] = field.key === 'time' ? value.padStart(8, '0') : value;
    }
    try {
      await create.mutateAsync({ name: name.trim() || TYPES[type].label, type, params: payload });
      setName('');
      setValues({});
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Không lưu được truy vấn.');
    }
  }

  async function run(queryId?: number) {
    setRunError('');
    try {
      const results = await runner.mutateAsync(queryId);
      setRuns((current) => ({ ...current, ...Object.fromEntries(results.map((result) => [result.query.id, result])) }));
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : 'Không chạy được truy vấn.');
    }
  }

  async function onDelete(query: SavedQuery) {
    if (!(await confirmAction('Xóa truy vấn?', query.name, 'Xóa'))) return;
    try {
      await remove.mutateAsync(query.id);
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : 'Không xóa được.');
    }
  }

  const list = queries.data ?? [];
  const failed = Object.values(runs).filter((result) => !result.ok).length;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Notice message={`Truy vấn mẫu chạy trên phiên bản đang dùng. Sau khi chuyển phiên bản, bấm “Chạy tất cả” để kiểm tra kết quả. Gợi ý hôm nay: ${getTransitDateTime().date}.`} />

      <SectionTitle>Thêm truy vấn</SectionTitle>
      <Card style={styles.form}>
        <ChipPicker label="LOẠI" options={typeOptions} value={type} onChange={(value) => { setType(value); setFormError(''); }} />
        <SearchField icon="bookmark-outline" accessibilityLabel="Tên truy vấn" placeholder={`Tên, ví dụ: ${TYPES[type].label} buổi sáng`} value={name} onChangeText={setName} maxLength={120} />
        {TYPES[type].fields.map((field) => (
          <View key={field.key}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>{field.label}{field.required ? ' *' : ''}</Text>
            <SearchField
              icon="create-outline"
              accessibilityLabel={field.label}
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChangeText={(text) => setValues((current) => ({ ...current, [field.key]: text }))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={field.key === 'limit' ? 'number-pad' : 'default'}
            />
          </View>
        ))}
        {formError ? <ErrorState message={formError} /> : null}
        <Button label="Lưu truy vấn" icon="add-circle-outline" loading={create.isPending} onPress={() => void save()} />
      </Card>

      <SectionTitle right={list.length ? <Button label="Chạy tất cả" icon="play" variant="ghost" loading={runner.isPending} onPress={() => void run()} /> : undefined}>
        {`Đã lưu (${list.length})`}
      </SectionTitle>
      {Object.keys(runs).length ? (
        <Notice tone={failed ? 'warning' : 'info'} message={failed ? `${failed} truy vấn trả về lỗi hoặc không tìm thấy.` : 'Tất cả truy vấn đã chạy thành công.'} />
      ) : null}
      {runError ? <ErrorState message={runError} /> : null}
      {queries.isLoading ? <LoadingState /> : null}
      {queries.isError ? <ErrorState message="Không tải được truy vấn." onRetry={() => void queries.refetch()} /> : null}
      {!queries.isLoading && !queries.isError && list.length === 0 ? (
        <EmptyState icon="list-outline" title="Chưa có truy vấn mẫu" message="Lưu vài truy vấn quen thuộc để kiểm tra mỗi lần đổi lịch." />
      ) : null}

      {list.map((query) => {
        const lastRun = runs[query.id];
        const ok = lastRun ? lastRun.ok : query.last_status !== null && query.last_status !== undefined ? query.last_status < 400 : undefined;
        return (
          <Card key={query.id} style={styles.query}>
            <View style={styles.queryHead}>
              <View style={styles.queryBody}>
                <Text style={[styles.queryName, { color: colors.ink }]}>{query.name}</Text>
                <Text style={[styles.queryMeta, { color: colors.muted }]}>{TYPES[query.type]?.label ?? query.type} · {describeParams(query)}</Text>
              </View>
              {ok !== undefined ? <Icon name={ok ? 'checkmark-circle' : 'alert-circle'} size={22} color={ok ? colors.primary : colors.danger} /> : null}
            </View>
            {query.last_run_at ? (
              <Text style={[styles.queryMeta, { color: colors.muted }]}>
                Lần chạy cuối {formatDateTime(query.last_run_at)} · phiên bản #{query.last_version_id ?? '—'} · {query.last_result_count ?? 0} kết quả
              </Text>
            ) : null}
            {lastRun ? <RunResult result={lastRun} /> : null}
            <View style={styles.actions}>
              <View style={styles.action}><Button label="Chạy" icon="play-outline" variant="outline" loading={runner.isPending && runner.variables === query.id} onPress={() => void run(query.id)} /></View>
              <View style={styles.action}><Button label="Xóa" icon="trash-outline" variant="ghost" onPress={() => void onDelete(query)} /></View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

function RunResult({ result }: { result: SavedQueryRun }) {
  const { colors } = useTheme();
  const lines = useMemo(() => summarize(result), [result]);
  return (
    <View style={[styles.result, { backgroundColor: result.ok ? colors.surfaceMuted : colors.dangerSurface }]}>
      <Text style={[styles.resultHead, { color: result.ok ? colors.ink : colors.danger }]}>
        {result.ok ? `${result.count} kết quả trên phiên bản #${result.version ?? '—'}` : result.errors?.[0]?.message ?? `Lỗi ${result.status}`}
      </Text>
      {lines.map((line, index) => <Text key={index} style={[styles.resultLine, { color: colors.ink }]} numberOfLines={1}>{line}</Text>)}
      {result.ok && result.count === 0 ? <Text style={[styles.resultLine, { color: colors.muted }]}>Không có kết quả cho tham số này.</Text> : null}
    </View>
  );
}

/** First few rows of a run, in a readable form for each query type. */
function summarize(result: SavedQueryRun): string[] {
  if (!result.ok) return [];
  const rows = (result.query.type === 'trip' ? result.stop_times : result.data) as Record<string, unknown>[] | null;
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 5).map((row) => {
    switch (result.query.type) {
      case 'departures':
        return `${row.departure_time} · ${row.trip_id} · tuyến ${row.route_short_name ?? row.route_id}${row.service_date ? ` · ngày ${row.service_date}` : ''}`;
      case 'route_trips':
        return `${row.departure_time ?? '--'} · ${row.trip_id} · ${row.headsign ?? ''}`;
      case 'trip':
        return `#${row.stop_sequence} ${row.stop_id} ${row.arrival_time}/${row.departure_time}`;
      case 'stops':
        return `${row.stop_id} · ${row.name}`;
      case 'routes':
        return `${row.route_id} · ${row.short_name ?? ''} ${row.long_name ?? ''}`;
      case 'journey':
        return `${row.departure_time} → ${row.arrival_time} · ${row.transfers} chuyển tuyến`;
      default:
        return JSON.stringify(row);
    }
  });
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  form: { gap: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  query: { gap: 6, marginBottom: spacing.sm },
  queryHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  queryBody: { flex: 1 },
  queryName: { fontSize: 15, fontWeight: '800' },
  queryMeta: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  result: { borderRadius: radius.sm, padding: 10, gap: 2 },
  resultHead: { fontSize: 13, fontWeight: '800' },
  resultLine: { fontSize: 12, lineHeight: 18 },
});
