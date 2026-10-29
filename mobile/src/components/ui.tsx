import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { radius, spacing, useTheme, type Palette } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.ink} accessibilityElementsHidden importantForAccessibility="no" />;
}

/** Eyebrow + title + optional subtitle used at the top of every screen. */
export function ScreenHeader({ eyebrow, title, subtitle, accent, right }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: 'primary' | 'secondary';
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  const accentColor = accent === 'secondary' ? colors.secondary : colors.primary;
  return (
    <View style={styles.header}>
      <View style={styles.headerBody}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: accentColor }]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.ink }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[styles.card, cardSurface(colors), style]}>{children}</View>;
}

/** Tappable row with a leading badge/icon, title, meta and trailing chevron. */
export function ListRow({ leading, title, meta, trailing, onPress, accessibilityLabel }: {
  leading?: ReactNode;
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={2}>{title}</Text>
        {meta ? <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={2}>{meta}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-forward" size={20} color={colors.muted} /> : null)}
    </>
  );
  if (!onPress) return <View style={[styles.row, cardSurface(colors)]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, cardSurface(colors), pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function Badge({ label, tone = 'primary', icon }: { label?: string; tone?: 'primary' | 'secondary'; icon?: IconName }) {
  const { colors } = useTheme();
  const fg = tone === 'secondary' ? colors.secondary : colors.primary;
  const bg = tone === 'secondary' ? colors.secondarySoft : colors.primarySoft;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      {label ? <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>{label}</Text> : null}
    </View>
  );
}

export function SearchField(props: TextInputProps & { icon?: IconName }) {
  const { colors } = useTheme();
  const { icon = 'search', style, ...rest } = props;
  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={20} color={colors.muted} />
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.fieldInput, { color: colors.ink }, style]}
        {...rest}
      />
      {rest.value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Xóa nội dung" hitSlop={10} onPress={() => rest.onChangeText?.('')}>
          <Icon name="close-circle" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({ label, onPress, icon, variant = 'primary', disabled, loading }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  const fg = variant === 'primary' ? colors.onPrimary : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'outline' && { borderColor: colors.primary, borderWidth: 1 },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{loading ? 'Đang xử lý…' : label}</Text>
    </Pressable>
  );
}

/** Pulsing placeholder rows shown while a query is loading. */
export function LoadingState({ rows = 3, height = 68 }: { rows?: number; height?: number }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View accessibilityLabel="Đang tải" accessibilityLiveRegion="polite">
      {Array.from({ length: rows }, (_, index) => (
        <Animated.View key={index} style={[styles.skeleton, { height, opacity, backgroundColor: colors.skeleton }]} />
      ))}
    </View>
  );
}

export function EmptyState({ icon = 'file-tray-outline', title, message, action }: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name={icon} size={28} color={colors.muted} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.ink }]}>{title}</Text>
      {message ? <Text style={[styles.stateMessage, { color: colors.muted }]}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.dangerSurface }]}>
      <Icon name="alert-circle" size={20} color={colors.danger} />
      <Text style={[styles.noticeText, { color: colors.danger }]}>{message}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry} style={[styles.retry, { borderColor: colors.danger }]}>
          <Text style={[styles.retryText, { color: colors.danger }]}>Thử lại</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Notice({ message, tone = 'info', icon }: { message: string; tone?: 'info' | 'warning'; icon?: IconName }) {
  const { colors } = useTheme();
  const fg = tone === 'warning' ? colors.warning : colors.primary;
  const bg = tone === 'warning' ? colors.warningSurface : colors.primarySoft;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: bg }]}>
      <Icon name={icon ?? (tone === 'warning' ? 'warning' : 'information-circle')} size={20} color={fg} />
      <Text style={[styles.noticeText, { color: fg }]}>{message}</Text>
    </View>
  );
}

function cardSurface(colors: Palette): ViewStyle {
  return { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow };
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  headerBody: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 27, fontWeight: '800', marginTop: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  card: { borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  row: { borderRadius: radius.lg, padding: 14, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', minHeight: 68, borderWidth: StyleSheet.hairlineWidth, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  leading: { marginRight: 12 },
  rowBody: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowMeta: { fontSize: 12, marginTop: 4 },
  pressed: { opacity: 0.72 },
  badge: { borderRadius: radius.sm, minWidth: 46, minHeight: 42, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, maxWidth: 96 },
  badgeText: { fontSize: 14, fontWeight: '800' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, minHeight: 52, paddingHorizontal: 14, gap: 10 },
  fieldInput: { flex: 1, fontSize: 16, minHeight: 50 },
  button: { borderRadius: radius.md, minHeight: 50, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.55 },
  skeleton: { borderRadius: radius.lg, marginBottom: spacing.sm },
  state: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  stateIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  stateTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  stateMessage: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: 12, gap: 10, marginBottom: spacing.sm },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  retry: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { fontWeight: '800', fontSize: 13 },
});
