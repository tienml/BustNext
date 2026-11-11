import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { spacing, useTheme } from '../theme';
import { Button, Card, ErrorState, Icon, LoadingState, ScreenHeader, SearchField } from '../components/ui';

export function AccountScreen() {
  const auth = useAuth();
  const favorites = useFavorites();
  const { colors, dark } = useTheme();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError('');
    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Vui lòng nhập email để nhận hướng dẫn đặt lại mật khẩu.');
        return;
      }
      setSubmitting(true);
      try {
        await apiClient.forgotPassword(email.trim());
        setError('Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư của bạn.');
        setMode('reset');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu đặt lại mật khẩu.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (mode === 'reset') {
      if (!email.trim() || !resetToken.trim() || !password || password !== confirmation) {
        setError('Vui lòng nhập email, mã khôi phục và hai mật khẩu giống nhau.');
        return;
      }
      setSubmitting(true);
      try {
        await apiClient.resetPassword(email.trim(), resetToken.trim(), password, confirmation);
        setMode('login');
        setPassword('');
        setConfirmation('');
        setResetToken('');
        setError('Mật khẩu đã được đổi. Bạn có thể đăng nhập bằng mật khẩu mới.');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Không thể đặt lại mật khẩu.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!email.trim() || !password || (mode === 'register' && !name.trim())) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    if (mode === 'register' && password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await auth.signIn(email.trim(), password);
      } else {
        await auth.signUp(name.trim(), email.trim(), password, confirmation);
      }
      setPassword('');
      setConfirmation('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể thực hiện yêu cầu.');
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}><LoadingState rows={3} /></View>
      </View>
    );
  }

  if (auth.user) {
    const stopCount = favorites.items.filter((item) => item.type === 'stop').length;
    const routeCount = favorites.items.filter((item) => item.type === 'route').length;
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow={auth.user.role === 'admin' ? 'TÀI KHOẢN QUẢN TRỊ' : 'TÀI KHOẢN BUSNEXT'}
          title={`Xin chào, ${auth.user.name}`}
          subtitle={auth.user.email}
        />
        <Card style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{auth.user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.stats}>
            <Stat icon="location" value={stopCount} label="Trạm đã lưu" />
            <Stat icon="bus" value={routeCount} label="Tuyến đã lưu" />
          </View>
        </Card>
        <Card style={styles.info}>
          {auth.user.role === 'admin' ? (
            <InfoRow icon="server-outline" text="Tài khoản quản trị: dùng tab Quản lý để nhập GTFS, kiểm tra lỗi, so sánh và kích hoạt phiên bản." />
          ) : null}
          <InfoRow icon="cloud-done-outline" text="Yêu thích được lưu trên tài khoản để dùng trên nhiều thiết bị." />
          <InfoRow icon={dark ? 'moon-outline' : 'sunny-outline'} text={`Giao diện ${dark ? 'tối' : 'sáng'} đang theo cài đặt của thiết bị.`} />
        </Card>
        <Button label="Đăng xuất" icon="log-out-outline" variant="outline" onPress={() => void auth.signOut()} />
      </ScrollView>
    );
  }

  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          eyebrow="TÀI KHOẢN BUSNEXT"
          title={isForgot ? 'Quên mật khẩu' : isReset ? 'Đặt mật khẩu mới' : isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
          subtitle={isForgot ? 'Nhập email để nhận hướng dẫn đặt lại mật khẩu.' : isReset ? 'Nhập mã trong email và mật khẩu mới.' : 'Đồng bộ trạm và tuyến yêu thích của bạn.'}
        />
        <Card style={styles.form}>
          {!isLogin && !isForgot && !isReset ? (
            <SearchField icon="person-outline" accessibilityLabel="Họ tên" placeholder="Họ tên" value={name} onChangeText={setName} autoComplete="name" />
          ) : null}
          <SearchField icon="mail-outline" accessibilityLabel="Email" placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
          {isReset ? <SearchField icon="key-outline" accessibilityLabel="Mã khôi phục" placeholder="Mã khôi phục trong email" value={resetToken} onChangeText={setResetToken} autoCapitalize="none" /> : null}
          {!isForgot ? (
            <>
              <SearchField icon="lock-closed-outline" accessibilityLabel="Mật khẩu" placeholder="Mật khẩu (tối thiểu 8 ký tự)" value={password} onChangeText={setPassword} secureTextEntry autoComplete={isLogin ? 'password' : 'new-password'} />
              {!isLogin ? (
                <SearchField icon="shield-checkmark-outline" accessibilityLabel="Xác nhận mật khẩu" placeholder="Xác nhận mật khẩu" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" />
              ) : null}
            </>
          ) : null}
          {error ? <ErrorState message={error} /> : null}
          <Button label={isForgot ? 'Gửi hướng dẫn' : isReset ? 'Đổi mật khẩu' : isLogin ? 'Đăng nhập' : 'Đăng ký'} icon={isForgot ? 'mail-outline' : isReset ? 'checkmark-circle-outline' : isLogin ? 'log-in-outline' : 'person-add-outline'} loading={submitting} onPress={() => void submit()} />
        </Card>
        {isLogin ? (
          <Pressable accessibilityRole="button" onPress={() => { setMode('forgot'); setError(''); }} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.secondary }]}>Quên mật khẩu?</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => { setMode(isForgot || isLogin ? (isForgot ? 'login' : 'register') : 'login'); setError(''); }}
          style={styles.link}
        >
          <Text style={[styles.linkText, { color: colors.secondary }]}>
            {isForgot || !isLogin ? 'Quay lại đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ icon, value, label }: { icon: 'location' | 'bus'; value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.ink }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: 'cloud-done-outline' | 'moon-outline' | 'sunny-outline' | 'server-outline'; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={20} color={colors.primary} />
      <Text style={[styles.infoText, { color: colors.ink }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 32 },
  form: { padding: spacing.md, gap: spacing.sm },
  link: { alignItems: 'center', padding: spacing.md },
  linkText: { fontWeight: '700' },
  profile: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800' },
  stats: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'flex-start', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  info: { padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
