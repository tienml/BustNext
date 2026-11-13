import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '../theme';
import { Icon } from './ui';
import { TransitRouteBadge } from './TransitRouteBadge';

export function TransitSignRow({ code, title, meta, label, onPress }: { code: string; title: string; meta: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.primarySoft }]}>
      <TransitRouteBadge label={code} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{meta}</Text>
      </View>
      <Icon name="chevron-forward" color={colors.muted} size={18} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, minHeight: 88, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  meta: { fontSize: 12, lineHeight: 19 },
});
