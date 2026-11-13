import { StyleSheet, Text, View } from 'react-native';
import type { ValidationIssue } from '../api/client';
import { radius, spacing, useTheme } from '../theme';
import { Icon } from './ui';

export function ValidationIssueCard({ issue }: { issue: ValidationIssue }) {
  const { colors } = useTheme();
  const isError = issue.severity === 'error';
  const tone = isError ? colors.danger : colors.warning;
  return (
    <View accessible accessibilityLabel={`${isError ? 'Lỗi' : 'Cảnh báo'}: ${issue.code}. ${issue.file_name || 'Toàn bộ dữ liệu'}${issue.row_number ? `, dòng ${issue.row_number}` : ''}${issue.column_name ? `, cột ${issue.column_name}` : ''}. ${issue.message}${issue.value != null && issue.value !== '' ? `. Giá trị: ${issue.value}` : ''}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: tone }]}>
      <View style={styles.heading}>
        <Icon name={isError ? 'close-circle' : 'warning'} size={18} color={tone} />
        <Text style={[styles.code, { color: tone }]}>{isError ? 'Lỗi' : 'Cảnh báo'} · {issue.code}</Text>
      </View>
      <Text style={[styles.location, { color: colors.muted }]}>{issue.file_name}{issue.row_number ? ` · dòng ${issue.row_number}` : ''}{issue.column_name ? ` · ${issue.column_name}` : ''}</Text>
      <Text style={[styles.message, { color: colors.ink }]}>{issue.message}</Text>
      {issue.value != null && issue.value !== '' ? <Text style={[styles.location, { color: colors.muted }]}>Giá trị: {issue.value}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, borderRadius: radius.md, padding: 12, gap: 4, marginBottom: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  code: { flex: 1, fontSize: 13, fontWeight: '800' },
  location: { fontSize: 13, lineHeight: 19 },
  message: { fontSize: 14, lineHeight: 20 },
});
