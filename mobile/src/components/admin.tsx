import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DatasetVersion, VersionStatus } from '../api/client';
import { radius, spacing, useTheme } from '../theme';
import { Icon, type IconName } from './ui';

const STATUS: Record<VersionStatus, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'muted'; icon: IconName }> = {
  active: { label: 'Đang dùng', tone: 'success', icon: 'checkmark-circle' },
  ready: { label: 'Sẵn sàng', tone: 'info', icon: 'shield-checkmark-outline' },
  failed: { label: 'Lỗi', tone: 'danger', icon: 'close-circle' },
  archived: { label: 'Lưu trữ', tone: 'muted', icon: 'archive-outline' },
  pending: { label: 'Chờ xử lý', tone: 'warning', icon: 'time-outline' },
  validating: { label: 'Đang kiểm tra', tone: 'warning', icon: 'sync-outline' },
};

export function StatusBadge({ status }: { status: VersionStatus }) {
  const { colors } = useTheme();
  const spec = STATUS[status] ?? STATUS.pending;
  const palette = {
    success: [colors.primary, colors.primarySoft],
    info: [colors.secondary, colors.secondarySoft],
    warning: [colors.warning, colors.warningSurface],
    danger: [colors.danger, colors.dangerSurface],
    muted: [colors.muted, colors.surfaceMuted],
  }[spec.tone];
  return (
    <View style={[styles.status, { backgroundColor: palette[1] }]} accessibilityLabel={`Trạng thái: ${spec.label}`}>
      <Icon name={spec.icon} size={14} color={palette[0]} />
      <Text style={[styles.statusText, { color: palette[0] }]}>{spec.label}</Text>
    </View>
  );
}

export function versionTitle(version: Pick<DatasetVersion, 'version_number' | 'label'>) {
  return version.label ? `v${version.version_number} · ${version.label}` : `Phiên bản ${version.version_number}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
}

/** Horizontal chip picker. */
export function ChipPicker<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value?: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.pickerBlock}>
      <Text style={[styles.pickerLabel, { color: colors.muted }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.primary : colors.ink }]} numberOfLines={1}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Small labelled number used in summary grids. */
export function Stat({ label, value, tone = 'ink' }: { label: string; value: number | string; tone?: 'ink' | 'primary' | 'danger' | 'warning' }) {
  const { colors } = useTheme();
  const color = { ink: colors.ink, primary: colors.primary, danger: colors.danger, warning: colors.warning }[tone];
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

/** Cross-platform yes/no confirmation. Alert buttons don't work on web. */
export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/**
 * Opens a signed CSV link. The server answers with Content-Disposition:
 * attachment, so on web the page stays put and the browser saves the file;
 * on a phone the system browser downloads it.
 */
export async function openDownload(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }
  await Linking.openURL(url);
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontWeight: '800' },
  pickerBlock: { marginBottom: spacing.sm },
  pickerLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 },
  chips: { gap: 8, paddingRight: spacing.md },
  chip: { borderWidth: 1, borderRadius: radius.md, minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', maxWidth: 220 },
  chipText: { fontSize: 14, fontWeight: '700' },
  stat: { flexGrow: 1, flexBasis: '30%', borderRadius: radius.md, padding: 12, minWidth: 90 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
});
