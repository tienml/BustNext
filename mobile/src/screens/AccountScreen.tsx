import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing } from '../theme';

export function AccountScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await auth.signIn(email.trim(), password);
      } else {
        await auth.signUp(name.trim(), email.trim(), password, confirmation);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể thực hiện yêu cầu.');
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.loading) {
    return <View style={styles.center}><Text style={styles.muted}>Đang kiểm tra tài khoản…</Text></View>;
  }

  if (auth.user) {
    return (
      <View style={styles.container}>
        <Text style={styles.eyebrow}>TÀI KHOẢN BUSNEXT</Text>
        <Text style={styles.title}>Xin chào, {auth.user.name}</Text>
        <Text style={styles.subtitle}>{auth.user.email}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dữ liệu của bạn được đồng bộ</Text>
          <Text style={styles.cardText}>Yêu thích được lưu trên tài khoản để dùng trên nhiều thiết bị.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Đăng xuất</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TÀI KHOẢN BUSNEXT</Text>
      <Text style={styles.title}>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</Text>
      <Text style={styles.subtitle}>Đồng bộ trạm và tuyến yêu thích của bạn.</Text>
      {mode === 'register' ? <TextInput accessibilityLabel="Họ tên" placeholder="Họ tên" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} /> : null}
      <TextInput accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} style={styles.input} />
      <TextInput accessibilityLabel="Mật khẩu" secureTextEntry placeholder="Mật khẩu" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} style={styles.input} />
      {mode === 'register' ? <TextInput accessibilityLabel="Xác nhận mật khẩu" secureTextEntry placeholder="Xác nhận mật khẩu" placeholderTextColor={colors.muted} value={confirmation} onChangeText={setConfirmation} style={styles.input} /> : null}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submit()} style={[styles.primaryButton, submitting && styles.disabled]}>
        <Text style={styles.primaryButtonText}>{submitting ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} style={styles.linkButton}>
        <Text style={styles.linkText}>{mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 7 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 20 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, minHeight: 52, paddingHorizontal: 16, color: colors.ink, fontSize: 16, marginBottom: 11 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: { borderColor: colors.primary, borderWidth: 1, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  secondaryButtonText: { color: colors.primary, fontWeight: '800' },
  linkButton: { alignItems: 'center', padding: 16 },
  linkText: { color: colors.secondary, fontWeight: '700' },
  card: { backgroundColor: colors.primarySoft, borderRadius: 16, padding: 16, marginTop: 8 },
  cardTitle: { color: colors.primary, fontWeight: '800' },
  cardText: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 6 },
  error: { backgroundColor: colors.dangerSurface, color: colors.danger, borderRadius: 12, padding: 12, marginBottom: 12 },
  disabled: { opacity: 0.55 },
  muted: { color: colors.muted },
});
