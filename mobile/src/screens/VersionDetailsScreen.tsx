import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useActivateVersion, useAdminClient, useValidationIssues, useVersions } from '../hooks/useAdmin';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useTheme } from '../theme';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, Notice, SectionTitle } from '../components/ui';
import { confirmAction, formatDateTime, openDownload, Stat, StatusBadge, versionTitle } from '../components/admin';

const FILE_LABELS: Record<string, string> = {
  'agency.txt': 'Đơn vị',
  'routes.txt': 'Tuyến',
  'stops.txt': 'Trạm',
  'trips.txt': 'Chuyến',
  'stop_times.txt': 'Giờ dừng',
  'calendar.txt': 'Lịch',
  'calendar_dates.txt': 'Ngoại lệ',
};

export function VersionDetailsScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'VersionDetails'>>();
  const { colors } = useTheme();
  const versions = useVersions(params.datasetId);
  const version = versions.data?.find((item) => item.id === params.versionId);
  const [page, setPage] = useState(1);
  const issues = useValidationIssues(params.versionId, page);
  const activate = useActivateVersion();
  const api = useAdminClient();
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<'schedule' | 'validation'>();

  async function onActivate() {
    if (!version) return;
    const ok = await confirmAction('Kích hoạt phiên bản?', `${versionTitle(version)} sẽ thay lịch trình đang dùng.`, 'Kích hoạt');
    if (!ok) return;
    setError('');
    try {
      await activate.mutateAsync(version.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không kích hoạt được.');
    }
  }

  async function download(kind: 'schedule' | 'validation') {
    setError('');
    setDownloading(kind);
    try {
      await openDownload(await api.exportUrl(params.versionId, kind));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không mở được liên kết tải xuống.');
    } finally {
      setDownloading(undefined);
    }
  }

  const issuePage = issues.data;
  const rows = issuePage?.data ?? [];

  const header = (
    <>
      {versions.isLoading ? <LoadingState rows={2} height={90} /> : null}
      {versions.isError ? <ErrorState message="Không tải được phiên bản." onRetry={() => void versions.refetch()} /> : null}
      {version ? (
        <Card style={styles.card}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.ink }]}>{versionTitle(version)}</Text>
            <StatusBadge status={version.status} />
          </View>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {[version.source_filename, `Nhập ${formatDateTime(version.imported_at ?? version.created_at)}`, version.activated_at ? `Kích hoạt ${formatDateTime(version.activated_at)}` : null].filter(Boolean).join('\n')}
          </Text>
          <View style={styles.stats}>
            <Stat label="Lỗi" value={version.error_count} tone={version.error_count ? 'danger' : 'ink'} />
            <Stat label="Cảnh báo" value={version.warning_count} tone={version.warning_count ? 'warning' : 'ink'} />
            {Object.entries(version.stats ?? {}).filter(([file]) => FILE_LABELS[file]).map(([file, count]) => (
              <Stat key={file} label={FILE_LABELS[file]} value={count} />
            ))}
          </View>
          {version.status === 'failed' ? <Notice tone="warning" message="Phiên bản lỗi không thể kích hoạt. Lịch đang dùng vẫn giữ nguyên." /> : null}
          {version.status === 'ready' || version.status === 'archived' ? (
            <Button label={version.status === 'archived' ? 'Kích hoạt lại' : 'Kích hoạt phiên bản này'} icon="flash-outline" loading={activate.isPending} onPress={() => void onActivate()} />
          ) : null}
          <View style={styles.actions}>
            {version.status !== 'failed' ? (
              <View style={styles.action}><Button label="Xuất lịch CSV" icon="download-outline" variant="outline" loading={downloading === 'schedule'} onPress={() => void download('schedule')} /></View>
            ) : null}
            <View style={styles.action}><Button label="Xuất báo cáo lỗi" icon="document-text-outline" variant="outline" loading={downloading === 'validation'} onPress={() => void download('validation')} /></View>
          </View>
        </Card>
      ) : null}
      {error ? <ErrorState message={error} /> : null}
      <SectionTitle>{`Lỗi và cảnh báo${issuePage ? ` (${issuePage.total})` : ''}`}</SectionTitle>
      {issues.isLoading ? <LoadingState /> : null}
      {issues.isError ? <ErrorState message="Không tải được danh sách lỗi." onRetry={() => void issues.refetch()} /> : null}
    </>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(item, index) => String(item.id ?? index)}
      ListHeaderComponent={header}
      ListEmptyComponent={issues.isLoading || issues.isError ? null : (
        <EmptyState icon="checkmark-done-outline" title="Không có lỗi" message="Tất cả tệp và tham chiếu đều hợp lệ." />
      )}
      renderItem={({ item }) => {
        const isError = item.severity === 'error';
        return (
          <View style={[styles.issue, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: isError ? colors.danger : colors.warning }]}>
            <View style={styles.issueHead}>
              <Icon name={isError ? 'close-circle' : 'warning'} size={16} color={isError ? colors.danger : colors.warning} />
              <Text style={[styles.issueCode, { color: isError ? colors.danger : colors.warning }]}>{item.code}</Text>
              <Text style={[styles.issueWhere, { color: colors.muted }]} numberOfLines={1}>
                {item.file_name}{item.row_number ? ` · dòng ${item.row_number}` : ''}{item.column_name ? ` · ${item.column_name}` : ''}
              </Text>
            </View>
            <Text style={[styles.issueMessage, { color: colors.ink }]}>{item.message}</Text>
            {item.value ? <Text style={[styles.issueValue, { color: colors.muted }]}>Giá trị: {item.value}</Text> : null}
          </View>
        );
      }}
      ListFooterComponent={issuePage && issuePage.last_page > 1 ? (
        <View style={styles.pager}>
          <View style={styles.action}><Button label="Trang trước" variant="outline" icon="chevron-back" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} /></View>
          <Text style={[styles.pageText, { color: colors.muted }]}>{issuePage.current_page}/{issuePage.last_page}</Text>
          <View style={styles.action}><Button label="Trang sau" variant="outline" disabled={page >= issuePage.last_page} onPress={() => setPage((p) => p + 1)} /></View>
        </View>
      ) : null}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40, flexGrow: 1 },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 20, fontWeight: '800' },
  meta: { fontSize: 13, lineHeight: 20 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
  issue: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, borderRadius: radius.md, padding: 12, marginBottom: spacing.sm, gap: 4 },
  issueHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  issueCode: { fontSize: 12, fontWeight: '800' },
  issueWhere: { flex: 1, fontSize: 12 },
  issueMessage: { fontSize: 14, lineHeight: 20 },
  issueValue: { fontSize: 12 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  pageText: { fontSize: 13, fontWeight: '700' },
});
