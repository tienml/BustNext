import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ImportResult } from '../api/client';
import { ValidationIssueCard } from '../components/ValidationIssueCard';
import { useActivateVersion, useDatasets, useImportVersion, useVersions } from '../hooks/useAdmin';
import type { RootStackParamList } from '../navigation/types';
import { spacing, useTheme } from '../theme';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, Notice, SearchField, SectionTitle } from '../components/ui';
import { WorkspaceHeading } from '../components/AdminWorkspaceVisuals';
import { ChipPicker, confirmAction, formatDateTime, StatusBadge, versionTitle } from '../components/admin';

export function AdminScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(false);
  const [confirmingActivation, setConfirmingActivation] = useState(false);
  const datasets = useDatasets();
  const [datasetId, setDatasetId] = useState<number>();
  const versions = useVersions(datasetId);
  const importer = useImportVersion(datasetId);
  const activate = useActivateVersion();
  const [label, setLabel] = useState('');
  const [result, setResult] = useState<ImportResult>();
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (datasetId === undefined && datasets.data?.length) setDatasetId(datasets.data[0].id);
  }, [datasetId, datasets.data]);

  const dataset = datasets.data?.find((item) => item.id === datasetId);
  const list = versions.data ?? [];
  const active = list.find((version) => version.status === 'active');
  const newestReady = useMemo(() => list.find((version) => version.status === 'ready'), [list]);

  async function pickAndImport() {
    if (picking || importer.isPending || confirmingActivation || activate.isPending || !datasetId) return;
    setPicking(true);
    setActionError('');
    try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    if (!asset.name.toLowerCase().endsWith('.zip')) {
      setActionError('Hãy chọn tệp GTFS dạng .zip.');
      return;
    }
      setResult(undefined);
      activate.reset();
      const imported = await importer.mutateAsync({
        file: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, file: asset.file },
        label: label.trim() || undefined,
      });
      setResult(imported);
      setLabel('');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không chọn hoặc nhập được tệp.');
    } finally {
      setPicking(false);
    }
  }

  async function activateVersion(versionId: number) {
    if (activate.isPending || confirmingActivation || picking || importer.isPending) return;
    setConfirmingActivation(true);
    setActionError('');
    try {
      // Refresh before confirmation so a stale import view cannot name the wrong active version.
      const refreshed = await versions.refetch();
      if (refreshed.isError) throw refreshed.error;
      const current = refreshed.data?.find((version) => version.id === versionId);
      if (current?.status !== 'ready') {
        const message = current?.status === 'active'
          ? 'Phiên bản này đã được kích hoạt và đang dùng.'
          : current?.status === 'archived'
            ? 'Phiên bản này đã được lưu trữ, không còn sẵn sàng để kích hoạt.'
            : 'Phiên bản không còn khả dụng hoặc chưa sẵn sàng. Vui lòng kiểm tra lại trạng thái.';
        throw new Error(message);
      }
      const currentActive = refreshed.data?.find((version) => version.status === 'active');
      const ok = await confirmAction('Kích hoạt phiên bản?', `${versionTitle(current)} sẽ thay thế ${currentActive ? versionTitle(currentActive) : 'lịch trình hiện tại (chưa có phiên bản đang dùng)'}. Mọi truy vấn mới sẽ dùng phiên bản này.`, 'Kích hoạt');
      if (!ok) return;
      await activate.mutateAsync(current.id);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không kích hoạt được.');
    } finally {
      setConfirmingActivation(false);
    }
  }

  const refreshing = datasets.isRefetching || versions.isRefetching;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + insets.bottom, paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void datasets.refetch(); void versions.refetch(); }} tintColor={colors.primary} />}
    >
      <WorkspaceHeading icon="server-outline" label="KHÔNG GIAN QUẢN TRỊ" title="Điều hành dữ liệu" description="Kiểm tra trước khi phát hành. Lịch hành khách chỉ thay đổi khi bạn xác nhận kích hoạt." />

      {datasets.isLoading ? <LoadingState rows={1} height={44} /> : null}
      {datasets.isError ? <ErrorState message="Không tải được danh sách bộ dữ liệu." onRetry={() => void datasets.refetch()} /> : null}
      {datasets.data && datasets.data.length > 1 ? (
        <ChipPicker disabled={picking || importer.isPending || confirmingActivation || activate.isPending} label="BỘ DỮ LIỆU" options={datasets.data.map((item) => ({ value: item.id, label: item.name }))} value={datasetId} onChange={(id) => { if (!picking && !importer.isPending && !confirmingActivation && !activate.isPending) { setDatasetId(id); setResult(undefined); setActionError(''); activate.reset(); } }} />
      ) : null}

      <Card style={[styles.activeCard, { borderLeftColor: colors.primary, backgroundColor: colors.surface }]}>
        <Icon name="radio-outline" size={22} color={colors.primary} />
        <Text style={[styles.cardEyebrow, { color: colors.muted }]}>ĐANG DÙNG{dataset ? ` · ${dataset.name}` : ''}</Text>
        {active ? (
          <>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>{versionTitle(active)}</Text>
            <Text style={[styles.cardMeta, { color: colors.muted }]}>Kích hoạt lúc {formatDateTime(active.activated_at)}</Text>
          </>
        ) : (
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{versions.isLoading ? 'Đang tải…' : 'Chưa có phiên bản nào được kích hoạt'}</Text>
        )}
        <View style={styles.actions}>
          <View style={styles.action}><Button label="So sánh" icon="git-compare-outline" variant="outline" disabled={!datasetId || list.length < 2} onPress={() => datasetId && navigation.navigate('CompareVersions', { datasetId })} /></View>
          <View style={styles.action}><Button label="Truy vấn mẫu" icon="list-outline" variant="outline" disabled={!datasetId} onPress={() => datasetId && navigation.navigate('SavedQueries', { datasetId })} /></View>
        </View>
      </Card>

      <SectionTitle>1. Nhập GTFS mới</SectionTitle>
      <Notice message="1. Nhập tệp → 2. Xem lỗi và cảnh báo → 3. So sánh → 4. Xác nhận kích hoạt. Lịch đang dùng không đổi cho tới bước cuối." />
      <Card style={styles.importCard}>
        <Text style={[styles.cardMeta, { color: colors.ink }]}>Nhãn phiên bản (không bắt buộc)</Text>
        <SearchField icon="pricetag-outline" accessibilityLabel="Nhãn phiên bản (không bắt buộc)" placeholder="Nhãn, ví dụ: Lịch tháng 11" value={label} onChangeText={setLabel} maxLength={120} />
        <Button label="Chọn tệp .zip và nhập" icon="cloud-upload-outline" loading={picking || importer.isPending} disabled={!datasetId || confirmingActivation || activate.isPending} onPress={() => void pickAndImport()} />
        <Text style={[styles.hint, { color: colors.muted }]}>Tệp được kiểm tra cột, tệp bắt buộc và tham chiếu. Phiên bản lỗi không ảnh hưởng lịch đang dùng.</Text>
      </Card>

      {activate.isSuccess ? <Notice message="Đã kích hoạt phiên bản thành công. Chạy lại truy vấn mẫu để kiểm tra lịch mới." /> : null}
      {activate.isSuccess && activate.data ? <Button label="Chạy lại truy vấn mẫu" icon="play-outline" variant="outline" onPress={() => navigation.navigate('SavedQueries', { datasetId: activate.data.data.dataset_id })} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {result ? (
        <Card style={styles.resultCard}>
          <View style={styles.resultHead}>
            <Text style={[styles.cardTitle, { color: colors.ink, flex: 1 }]}>{versionTitle(result.version)}</Text>
            <StatusBadge status={result.status} />
          </View>
          <Text style={[styles.cardMeta, { color: colors.muted }]}>
            {result.status === 'ready'
              ? `Hợp lệ. ${result.warnings.length} cảnh báo. Bạn có thể so sánh rồi kích hoạt.`
              : `${result.errors.length} lỗi, ${result.warnings.length} cảnh báo. Lịch đang dùng không thay đổi.`}
          </Text>
          {[...result.errors, ...result.warnings].slice(0, 5).map((issue, index) => <ValidationIssueCard key={`${issue.severity}-${issue.code}-${index}`} issue={issue} />)}
          {result.errors.length + result.warnings.length > 5 ? <Text style={[styles.hint, { color: colors.muted }]}>Hiển thị 5 mục đầu. Mở chi tiết để xem toàn bộ lỗi và cảnh báo.</Text> : null}
          <View style={styles.actions}>
            <View style={styles.action}><Button label="Xem chi tiết" variant="outline" onPress={() => navigation.navigate('VersionDetails', { versionId: result.version.id, datasetId: result.version.dataset_id })} /></View>
            {result.status === 'ready' && list.length >= 2 ? <View style={styles.action}><Button label="So sánh" icon="git-compare-outline" variant="outline" onPress={() => navigation.navigate('CompareVersions', { datasetId: result.version.dataset_id, baseVersionId: active?.id, targetVersionId: result.version.id })} /></View> : null}
            {result.status === 'ready' && !activate.isSuccess && active?.id !== result.version.id ? (
              <View style={styles.action}><Button label="Kích hoạt" icon="flash-outline" loading={confirmingActivation || activate.isPending} onPress={() => void activateVersion(result.version.id)} /></View>
            ) : null}
          </View>
        </Card>
      ) : null}

      <SectionTitle>Lịch sử phiên bản</SectionTitle>
      <Text style={[styles.hint, { color: colors.muted, marginBottom: spacing.md }]}>Mở một bản phát hành để kiểm tra dữ liệu và báo cáo.</Text>
      {newestReady && !result ? <Notice message={`${versionTitle(newestReady)} đã sẵn sàng nhưng chưa kích hoạt.`} /> : null}
      {versions.isLoading ? <LoadingState /> : null}
      {versions.isError ? <ErrorState message="Không tải được danh sách phiên bản." onRetry={() => void versions.refetch()} /> : null}
      {!versions.isLoading && !versions.isError && list.length === 0 ? (
        <EmptyState icon="layers-outline" title="Chưa có phiên bản" message="Nhập một tệp GTFS để bắt đầu." />
      ) : null}
      {list.map((version) => (
        <Pressable key={version.id} accessibilityRole="button" accessibilityLabel={`${versionTitle(version)}, ${version.status === 'active' ? 'đang dùng, ' : ''}mở chi tiết`} onPress={() => navigation.navigate('VersionDetails', { versionId: version.id, datasetId: version.dataset_id })} style={({ pressed }) => [styles.release, { borderColor: colors.border, backgroundColor: version.status === 'active' ? colors.primarySoft : colors.surface, opacity: pressed ? 0.72 : 1 }]}>
          <View style={[styles.releaseMark, { borderColor: colors.border }]}><Icon name={version.status === 'active' ? 'checkmark-circle' : 'layers-outline'} size={22} color={version.status === 'active' ? colors.primary : colors.muted} /><Text style={[styles.cardEyebrow, { color: colors.muted }]}>v{version.version_number}</Text></View>
          <View style={styles.releaseBody}>
            <StatusBadge status={version.status} />
            <Text style={[styles.cardTitle, { color: colors.ink, fontSize: 16 }]}>{versionTitle(version)}</Text>
            <Text style={[styles.cardMeta, { color: colors.muted }]}>{version.source_filename}</Text>
            <Text style={[styles.hint, { color: colors.muted }]}>{formatDateTime(version.imported_at ?? version.created_at)}</Text>
            {version.error_count || version.warning_count ? <Text style={[styles.hint, { color: version.error_count ? colors.danger : colors.warning }]}>{version.error_count} lỗi · {version.warning_count} cảnh báo</Text> : null}
          </View>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  activeCard: { gap: 8, borderLeftWidth: 4, shadowOpacity: 0, elevation: 0 },
  release: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 80 },
  releaseMark: { alignItems: 'center', alignSelf: 'stretch', gap: 10, paddingRight: 12, borderRightWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  releaseBody: { flex: 1, gap: 5 },
  cardEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardMeta: { fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
  importCard: { gap: spacing.sm },
  hint: { fontSize: 12, lineHeight: 18 },
  resultCard: { gap: 6, marginTop: spacing.sm },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
