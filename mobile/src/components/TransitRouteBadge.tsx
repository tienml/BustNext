import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from '../theme';

/** Brand signage, not an official operator route colour. */
export function TransitRouteBadge({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
      <Text style={[styles.caption, { color: colors.primary }]}>TUYẾN</Text>
      <Text style={[styles.code, { color: colors.primary }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: { minWidth: 56, maxWidth: '35%', minHeight: 56, padding: spacing.sm, borderRadius: radius.sm, borderLeftWidth: 3, alignItems: 'center', justifyContent: 'center', gap: 3 },
  caption: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  code: { fontSize: 20, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
});
