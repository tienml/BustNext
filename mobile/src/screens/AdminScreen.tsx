import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import type { ImportResult } from '../api/client';
import { useActivateVersion, useDatasets, useImportVersion, useVersions } from '../hooks/useAdmin';
import type { RootStackParamList } from '../navigation/types';
import { spacing, useTheme } from '../theme';
import { Button, Card, EmptyState, ErrorState, ListRow, LoadingState, Notice, ScreenHeader, SearchField, SectionTitle } from '../components/ui';
import { ChipPicker, confirmAction, formatDateTime, StatusBadge, versionTitle } from '../components/admin';

export function AdminScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
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
    setActionError('');
    setResult(undefined);
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
    try {
      const imported = await importer.mutateAsync({
        file: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, file: asset.file },
        label: label.trim() || undefined,
      });
      setResult(imported);
      setLabel('');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không nhập được tệp.');
    }
  }

  async function activateVersion(versionId: number, title: string) {
    const ok = await confirmAction('Kích hoạt phiên bản?', `${title} sẽ thay lịch trình đang dùng cho mọi người tra cứu.`, 'Kích hoạt');
    if (!ok) return;
    setActionError('');
    try {
      await activate.mutateAsync(versionId);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Không kích hoạt được.');
    }
  }

  const refreshing = datasets.isRefetching || versions.isRefetching;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void datasets.refetch(); void versions.refetch(); }} tintColor={colors.primary} />}
    >
      <ScreenHeader eyebrow="QUẢN LÝ DỮ LIỆU" title="Lịch trình GTFS" subtitle="Nhập bộ dữ liệu mới, xem lỗi kiểm tra, so sánh và chọn phiên bản đang dùng." />

      {datasets.isLoading ? <LoadingState rows={1} height={44} /> : null}
      {datasets.isError ? <ErrorState message="Không tải được danh sách bộ dữ liệu." onRetry={() => void datasets.refetch()} /> : null}
      {datasets.data && datasets.data.length > 1 ? (
        <ChipPicker label="BỘ DỮ LIỆU" options={datasets.data.map((item) => ({ value: item.id, label: item.name }))} value={datasetId} onChange={setDatasetId} />
      ) : null}

      <Card style={styles.activeCard}>
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

      <SectionTitle>Nhập GTFS mới</SectionTitle>
      <Card style={styles.importCard}>
        <SearchField icon="pricetag-outline" accessibilityLabel="Nhãn phiên bản (không bắt buộc)" placeholder="Nhãn, ví dụ: Lịch tháng 11" value={label} onChangeText={setLabel} maxLength={120} />
        <Button label="Chọn tệp .zip và nhập" icon="cloud-upload-outline" loading={importer.isPending} disabled={!datasetId} onPress={() => void pickAndImport()} />
        <Text style={[styles.hint, { color: colors.muted }]}>Tệp được kiểm tra cột, tệp bắt buộc và tham chiếu. Phiên bản lỗi không ảnh hưởng lịch đang dùng.</Text>
      </Card>

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
          <View style={styles.actions}>
            <View style={styles.action}><Button label="Xem chi tiết" variant="outline" onPress={() => navigation.navigate('VersionDetails', { versionId: result.version.id, datasetId: result.version.dataset_id })} /></View>
            {result.status === 'ready' ? (
              <View style={styles.action}><Button label="Kích hoạt" icon="flash-outline" loading={activate.isPending} onPress={() => void activateVersion(result.version.id, versionTitle(result.version))} /></View>
            ) : null}
          </View>
        </Card>
      ) : null}

      <SectionTitle>Các phiên bản</SectionTitle>
      {newestReady && !result ? <Notice message={`${versionTitle(newestReady)} đã sẵn sàng nhưng chưa kích hoạt.`} /> : null}
      {versions.isLoading ? <LoadingState /> : null}
      {versions.isError ? <ErrorState message="Không tải được danh sách phiên bản." onRetry={() => void versions.refetch()} /> : null}
      {!versions.isLoading && !versions.isError && list.length === 0 ? (
        <EmptyState icon="layers-outline" title="Chưa có phiên bản" message="Nhập một tệp GTFS để bắt đầu." />
      ) : null}
      {list.map((version) => (
        <ListRow
          key={version.id}
          title={versionTitle(version)}
          meta={[
            version.source_filename,
            version.status === 'failed' ? `${version.error_count} lỗi` : version.warning_count ? `${version.warning_count} cảnh báo` : null,
            formatDateTime(version.imported_at ?? version.created_at),
          ].filter(Boolean).join(' · ')}
          trailing={<StatusBadge status={version.status} />}
          accessibilityLabel={`${versionTitle(version)}, mở chi tiết`}
          onPress={() => navigation.navigate('VersionDetails', { versionId: version.id, datasetId: version.dataset_id })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  activeCard: { gap: 6 },
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
