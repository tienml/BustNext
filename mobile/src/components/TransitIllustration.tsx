import { StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '../theme';

/** Original, local View artwork. Decorative only; never represents a live vehicle. */
export function TransitIllustration({ variant = 'bus', compact = false }: {
  variant?: 'bus' | 'search' | 'favorites' | 'nearby';
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const size = compact ? 88 : 120;
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size * 0.75, flexShrink: 0 }}>
      <View style={[styles.halo, { backgroundColor: colors.primarySoft }]} />
      <View style={[styles.building, { left: '12%', height: '40%', backgroundColor: colors.border }]} />
      <View style={[styles.building, { left: '30%', height: '60%', backgroundColor: colors.surfaceMuted }]} />
      <View style={[styles.building, { right: '8%', height: '48%', backgroundColor: colors.border }]} />
      <View style={[styles.road, { backgroundColor: colors.muted }]} />
      {variant === 'bus' ? (
        <View style={[styles.bus, { backgroundColor: colors.primary }]}>
          <View style={styles.windows}>
            {[0, 1, 2].map((window) => <View key={window} style={[styles.window, { backgroundColor: colors.onPrimary }]} />)}
            <View style={[styles.door, { borderColor: colors.onPrimary }]} />
          </View>
          <View style={[styles.stripe, { backgroundColor: colors.onPrimary }]} />
          <View style={[styles.wheel, { left: '14%', backgroundColor: colors.ink, borderColor: colors.surface }]} />
          <View style={[styles.wheel, { right: '14%', backgroundColor: colors.ink, borderColor: colors.surface }]} />
        </View>
      ) : (
        <>
          <View style={[styles.pole, { backgroundColor: colors.primary }]} />
          <View style={[styles.stopSign, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            {variant === 'search' ? <View style={[styles.lens, { borderColor: colors.onPrimary }]} /> :
              variant === 'favorites' ? <View style={[styles.bookmark, { borderColor: colors.onPrimary }]} /> :
                <View style={[styles.stopMark, { backgroundColor: colors.onPrimary }]} />}
          </View>
        </>
      )}
    </View>
  );
}

/** Unboxed empty state, shared with screens that need the same illustration language. */
export function TransitEmptyState({ title, message, variant = 'nearby' }: {
  title: string;
  message: string;
  variant?: 'search' | 'favorites' | 'nearby';
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <TransitIllustration variant={variant} compact />
      <Text style={[styles.emptyTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute', width: '78%', height: '96%', right: '4%', top: 0, borderRadius: 60 },
  building: { position: 'absolute', width: '18%', bottom: '18%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  road: { position: 'absolute', left: '4%', right: 0, bottom: '14%', height: 2, borderRadius: 1 },
  bus: { position: 'absolute', left: '3%', right: '4%', bottom: '23%', height: '45%', borderRadius: 9 },
  windows: { flexDirection: 'row', gap: 3, padding: 5, height: '78%' },
  window: { flex: 1, borderRadius: 2, opacity: 0.9 },
  door: { width: '20%', borderWidth: 1, borderRadius: 2 },
  stripe: { position: 'absolute', left: '6%', right: '6%', bottom: '13%', height: 2, opacity: 0.7 },
  wheel: { position: 'absolute', bottom: -5, width: 13, height: 13, borderRadius: 7, borderWidth: 3 },
  pole: { position: 'absolute', left: '49%', width: 3, bottom: '16%', height: '50%' },
  stopSign: { position: 'absolute', left: '31%', top: '9%', width: '39%', height: '49%', borderRadius: 9, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  lens: { width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  bookmark: { width: 12, height: 16, borderWidth: 2, borderBottomLeftRadius: 5 },
  stopMark: { width: 14, height: 10, borderRadius: 3 },
  empty: { alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.lg, gap: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyMessage: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 360 },
});
