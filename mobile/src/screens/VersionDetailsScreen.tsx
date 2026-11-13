import { useState } from 'react';
import { ValidationIssueCard } from '../components/ValidationIssueCard';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivateVersion, useAdminClient, useValidationIssues, useVersions } from '../hooks/useAdmin';
import type { RootStackParamList } from '../navigation/types';
import { spacing, useTheme } from '../theme';
import { Button, Card, EmptyState, ErrorState, LoadingState, Notice, SectionTitle } from '../components/ui';
import { ChipPicker, confirmAction, formatDateTime, openDownload, StatusBadge, versionTitle } from '../components/admin';
import { WorkspaceFact, WorkspaceHeading } from '../components/AdminWorkspaceVisuals';

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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [severity, setSeverity] = useState('all');
  const [file, setFile] = useState('all');
  const [downloadNotice, setDownloadNotice] = useState('');
  const versions = useVersions(params.datasetId);
  const version = versions.data?.find((item) => item.id === params.versionId);
  const [page, setPage] = useState(1);
  const issues = useValidationIssues(params.versionId, page);
  const activate = useActivateVersion();
  const api = useAdminClient();
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState<'schedule' | 'validation'>();

  async function onActivate() {
    if (!version || version.status !== 'ready' || activate.isPending || confirming) return;
    setConfirming(true);
    setError('');
    try {
      const refreshed = await versions.refetch();
      if (refreshed.isError) throw refreshed.error;
      const current = refreshed.data?.find((item) => item.id === version.id);
      if (current?.status !== 'ready') throw new Error('Phiên bản không còn sẵn sàng. Vui lòng kiểm tra lại trạng thái.');
      const active = refreshed.data?.find((item) => item.status === 'active');
      const ok = await confirmAction('Kích hoạt phiên bản?', `${versionTitle(current)} sẽ thay thế ${active ? versionTitle(active) : 'lịch trình hiện tại (chưa có phiên bản đang dùng)'}. Mọi truy vấn mới sẽ dùng phiên bản này.`, 'Kích hoạt');
      if (!ok) return;
      await activate.mutateAsync(current.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không kích hoạt được.');
    } finally {
      setConfirming(false);
    }
  }

  async function download(kind: 'schedule' | 'validation') {
    if (downloading) return;
    setError('');
    setDownloadNotice('');
    setDownloading(kind);
    try {
      await openDownload(await api.exportUrl(params.versionId, kind));
      setDownloadNotice('Đã mở liên kết tải xuống. Kiểm tra trình duyệt hoặc thư mục tải về để xác nhận tệp đã được lưu.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không mở được liên kết tải xuống.');
    } finally {
      setDownloading(undefined);
    }
  }

  const issuePage = issues.data;
  const pageRows = issuePage?.data ?? [];
  const rows = pageRows.filter((issue) => (severity === 'all' || issue.severity === severity) && (file === 'all' || issue.file_name === file)).sort((a, b) => a.file_name.localeCompare(b.file_name));
  const fileOptions = [...new Set(pageRows.map((issue) => issue.file_name))].sort().map((value) => ({ value, label: value }));

  const header = (
    <>
      <WorkspaceHeading icon="shield-checkmark-outline" label="HỒ SƠ PHIÊN BẢN" title="Kiểm tra dữ liệu" description="Đọc kết quả kiểm tra, đối chiếu thay đổi rồi quyết định phát hành." />
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
          <View>
            <WorkspaceFact icon="close-circle-outline" label="Lỗi cần xử lý" value={version.error_count} tone={version.error_count ? 'danger' : 'ink'} />
            <WorkspaceFact icon="warning-outline" label="Cảnh báo cần xem" value={version.warning_count} tone={version.warning_count ? 'warning' : 'ink'} />
          </View>
          <Text style={[styles.fileLabel, { color: colors.muted }]}>NỘI DUNG BỘ DỮ LIỆU</Text>
          {Object.entries(version.stats ?? {}).filter(([file]) => FILE_LABELS[file]).map(([file, count]) => (
            <WorkspaceFact key={file} label={`${FILE_LABELS[file]} · ${file}`} value={`${count} bản ghi`} />
          ))}
          {version.status === 'ready' || version.status === 'archived' ? (
            <Button label={version.status === 'archived' ? 'So sánh phiên bản lưu trữ' : 'So sánh trước khi kích hoạt'} icon="git-compare-outline" variant="outline" disabled={(versions.data?.filter((item) => item.status === 'ready' || item.status === 'active' || item.status === 'archived').length ?? 0) < 2} onPress={() => navigation.navigate('CompareVersions', { datasetId: params.datasetId, baseVersionId: versions.data?.find((item) => item.status === 'active')?.id, targetVersionId: version.id })} />
          ) : null}
          {version.status === 'failed' ? <Notice tone="warning" message="Phiên bản lỗi không thể kích hoạt. Lịch đang dùng vẫn giữ nguyên." /> : null}
          {version.status === 'archived' ? <Notice tone="warning" message="Phiên bản lưu trữ chỉ dùng để xem và so sánh, không thể kích hoạt lại. Để dùng lịch này, hãy nhập lại tệp GTFS thành phiên bản mới rồi kiểm tra và kích hoạt." /> : null}
          {version.status === 'ready' ? (
            <Button label="Kích hoạt phiên bản này" icon="flash-outline" loading={confirming || activate.isPending} onPress={() => void onActivate()} />
          ) : null}
          <View style={styles.actions}>
            {version.status !== 'failed' ? (
              <View style={styles.action}><Button label="Xuất lịch CSV" icon="download-outline" variant="outline" disabled={!!downloading} loading={downloading === 'schedule'} onPress={() => void download('schedule')} /></View>
            ) : null}
            <View style={styles.action}><Button label="Xuất báo cáo lỗi" icon="document-text-outline" variant="outline" disabled={!!downloading} loading={downloading === 'validation'} onPress={() => void download('validation')} /></View>
          </View>
        </Card>
      ) : null}
      {activate.isSuccess ? <Notice message="Đã kích hoạt phiên bản thành công. Các truy vấn mới sẽ dùng lịch này." /> : null}
      {activate.isSuccess || version?.status === 'active' ? <Button label="Chạy lại truy vấn mẫu" icon="play-outline" variant="outline" onPress={() => navigation.navigate('SavedQueries', { datasetId: params.datasetId })} /> : null}
      {downloadNotice ? <Notice message={downloadNotice} /> : null}
      {error ? <ErrorState message={error} /> : null}
      <SectionTitle>{`Lỗi và cảnh báo${issuePage ? ` (${issuePage.total})` : ''}`}</SectionTitle>
      <Text style={[styles.meta, { color: colors.muted }]}>Bộ lọc áp dụng cho trang hiện tại; chuyển trang để kiểm tra các mục còn lại.</Text>
      <ChipPicker label="MỨC ĐỘ · TRANG HIỆN TẠI" value={severity} onChange={setSeverity} options={[{ value: 'all', label: 'Tất cả' }, { value: 'error', label: 'Lỗi' }, { value: 'warning', label: 'Cảnh báo' }]} />
      <ChipPicker label="TỆP · TRANG HIỆN TẠI" value={file} onChange={setFile} options={[{ value: 'all', label: 'Tất cả tệp' }, ...fileOptions]} />
      {issuePage ? <Text style={[styles.meta, { color: colors.muted }]}>{rows.length}/{pageRows.length} mục trên trang {issuePage.current_page} · {issuePage.total} mục toàn bộ</Text> : null}
      {issues.isLoading ? <LoadingState /> : null}
      {issues.isError ? <ErrorState message="Không tải được danh sách lỗi." onRetry={() => void issues.refetch()} /> : null}
    </>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}
      data={rows}
      keyExtractor={(item, index) => String(item.id ?? index)}
      ListHeaderComponent={header}
      ListEmptyComponent={issues.isLoading || issues.isError ? null : (
        <EmptyState icon="checkmark-done-outline" title={severity !== 'all' || file !== 'all' ? 'Không có mục khớp trên trang này' : 'Không có lỗi và cảnh báo'} message={severity !== 'all' || file !== 'all' ? 'Đổi bộ lọc hoặc chuyển trang để xem các mục khác.' : 'Không có mục kiểm tra nào được trả về cho phiên bản này.'} />
      )}
      renderItem={({ item, index }) => <View>
        {index === 0 || rows[index - 1].file_name !== item.file_name ? <View style={[styles.fileGroup, { borderBottomColor: colors.border }]}><Text accessibilityRole="header" style={[styles.fileLabel, { color: colors.ink }]}>{item.file_name || 'Không xác định tệp'}</Text><Text style={[styles.meta, { color: colors.muted }]}>{rows.filter((row) => row.file_name === item.file_name).length} mục khớp trên trang này</Text></View> : null}
        <ValidationIssueCard issue={item} />
      </View>}
      ListFooterComponent={issuePage && issuePage.last_page > 1 ? (
        <View style={styles.pager}>
          <View style={styles.action}><Button label="Trang trước" variant="outline" icon="chevron-back" disabled={page <= 1} onPress={() => { setFile('all'); setPage((p) => p - 1); }} /></View>
          <Text style={[styles.pageText, { color: colors.muted }]}>{issuePage.current_page}/{issuePage.last_page}</Text>
          <View style={styles.action}><Button label="Trang sau" variant="outline" disabled={page >= issuePage.last_page} onPress={() => { setFile('all'); setPage((p) => p + 1); }} /></View>
        </View>
      ) : null}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40, flexGrow: 1 },
  card: { gap: spacing.sm, shadowOpacity: 0, elevation: 0 },
  fileLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: 6 },
  fileGroup: { paddingVertical: 12, marginBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 20, fontWeight: '800' },
  meta: { fontSize: 13, lineHeight: 20 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
  pager: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  pageText: { fontSize: 13, fontWeight: '700' },
});
