import { StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '../theme';
import { Icon, type IconName } from './ui';

/** Quiet, document-like admin hierarchy, distinct from passenger route cards. */
export function WorkspaceHeading({ icon, label, title, description }: { icon: IconName; label: string; title: string; description: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.heading, { borderBottomColor: colors.border }]}>
      <View style={styles.kicker}><Icon name={icon} size={18} color={colors.primary} /><Text style={[styles.label, { color: colors.primary }]}>{label}</Text></View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
    </View>
  );
}

/** A labelled document row, not a KPI tile. Values can wrap at large font sizes. */
export function WorkspaceFact({ label, value, icon, tone = 'ink' }: { label: string; value: string | number; icon?: IconName; tone?: 'ink' | 'primary' | 'danger' | 'warning' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fact, { borderBottomColor: colors.border }]}>
      {icon ? <Icon name={icon} size={18} color={colors[tone]} /> : null}
      <Text style={[styles.factLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: colors[tone] }]}>{value}</Text>
    </View>
  );
}

export function WorkspaceChange({ label, before, after }: { label: string; before: string; after: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.change, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
      <View style={styles.columns}>
        <View style={styles.column}><Text style={[styles.caption, { color: colors.muted }]}>TRƯỚC</Text><Text selectable style={[styles.value, { color: colors.ink }]}>{before}</Text></View>
        <Icon name="arrow-forward" size={16} color={colors.muted} />
        <View style={styles.column}><Text style={[styles.caption, { color: colors.primary }]}>SAU</Text><Text selectable style={[styles.value, { color: colors.ink }]}>{after}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.lg, marginBottom: spacing.lg, gap: 8 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, flexShrink: 1 },
  title: { fontSize: 26, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 22 },
  fact: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  factLabel: { flexGrow: 1, flexBasis: 120, fontSize: 13, lineHeight: 20 },
  factValue: { flexShrink: 1, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  change: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, gap: 10, marginTop: 6 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  column: { flex: 1, minWidth: 0, gap: 5 },
  caption: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  value: { fontSize: 13, lineHeight: 21, fontVariant: ['tabular-nums'] },
});
