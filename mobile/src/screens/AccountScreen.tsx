import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { otpValidityLabel, remainingSeconds } from '../utils/otpTiming';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { spacing, useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ErrorState, Icon, LoadingState, ScreenHeader, SearchField } from '../components/ui';

export function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const favorites = useFavorites();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const contentStyle = [styles.content, { paddingBottom: spacing.xl + insets.bottom }];
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(300);

  useEffect(() => {
    const tick = () => setResendSeconds(remainingSeconds(resendAt));
    tick();
    if (resendAt <= Date.now()) return;
    const timer = setInterval(() => {
      tick();
      if (resendAt <= Date.now()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  async function requestOtp() {
    if (submitting || Date.now() < resendAt) return;
    if (!email.trim()) {
      setError('Vui lòng nhập email để nhận mã OTP.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = await apiClient.forgotPassword(email.trim());
      setResendAt(Date.now() + response.data.resend_after * 1000);
      setOtpExpiresIn(response.data.expires_in);
      setResetToken('');
      setPassword('');
      setConfirmation('');
      setError(`Nếu email tồn tại, mã OTP sẽ được gửi. Mã có hiệu lực ${otpValidityLabel(response.data.expires_in)} kể từ khi cấp. Kiểm tra cả thư rác. Có thể yêu cầu gửi lại sau ${response.data.resend_after} giây.`);
      setMode('reset');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu nhận OTP.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    setError('');
    if (mode === 'forgot') {
      await requestOtp();
      return;
    }
    if (mode === 'reset') {
      if (!email.trim() || !/^[0-9]{6}$/.test(resetToken) || password.length < 8 || password !== confirmation) {
        setError('Nhập email, OTP đúng 6 chữ số và hai mật khẩu giống nhau (tối thiểu 8 ký tự).');
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
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle}>
        <ScreenHeader eyebrow="KHÔNG GIAN CÁ NHÂN" title="Tài khoản" />
        <View style={[styles.profile, { borderBottomColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{auth.user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={[styles.profileName, { color: colors.ink }]}>{auth.user.name}</Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>{auth.user.email}</Text>
            <Text style={[styles.role, { color: colors.primary }]}>{auth.user.role === 'admin' ? 'Quản trị viên' : 'Đã đăng nhập'}</Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={[styles.groupLabel, { color: colors.muted }]}>THƯ VIỆN CỦA BẠN</Text>
        {favorites.isError ? <ErrorState message="Không tải được yêu thích." onRetry={() => void favorites.refetch()} /> : null}
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow icon="location-outline" text={favorites.isLoading ? 'Đang tải trạm đã lưu…' : favorites.isError ? 'Trạm đã lưu · Chưa tải được' : `Trạm đã lưu · ${stopCount}`} />
          <InfoRow icon="bus-outline" text={favorites.isLoading ? 'Đang tải tuyến đã lưu…' : favorites.isError ? 'Tuyến đã lưu · Chưa tải được' : `Tuyến đã lưu · ${routeCount}`} />
          <InfoRow icon="cloud-done-outline" text="Yêu thích được lưu trên tài khoản để dùng trên nhiều thiết bị." />
        </View>
        {auth.user.role === 'admin' ? (
          <>
            <Text accessibilityRole="header" style={[styles.groupLabel, { color: colors.muted }]}>KHÔNG GIAN QUẢN TRỊ</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Quản lý dữ liệu GTFS" onPress={() => navigation.navigate('Admin')} style={({ pressed }) => [styles.adminEntry, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.72 : 1 }]}>
              <Icon name="server-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1, gap: 4 }}><Text style={[styles.profileName, { color: colors.primary, fontSize: 16 }]}>Quản lý dữ liệu</Text><Text style={[styles.infoText, { color: colors.ink }]}>Nhập GTFS, kiểm tra và phát hành lịch trình.</Text></View>
              <Icon name="chevron-forward" size={20} color={colors.primary} />
            </Pressable>
          </>
        ) : null}
        <Text accessibilityRole="header" style={[styles.groupLabel, { color: colors.muted }]}>GIAO DIỆN</Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow icon={dark ? 'moon-outline' : 'sunny-outline'} text={`Chế độ ${dark ? 'tối' : 'sáng'} · Theo cài đặt thiết bị`} />
        </View>
        <View style={[styles.signOut, { borderTopColor: colors.border }]}><Button label="Đăng xuất" icon="log-out-outline" variant="outline" onPress={() => void auth.signOut()} /></View>
      </ScrollView>
    );
  }

  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          eyebrow="TÀI KHOẢN BUSNEXT"
          title={isForgot ? 'Quên mật khẩu' : isReset ? 'Đặt mật khẩu mới' : isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
          subtitle={isForgot ? 'Nhập email để nhận mã OTP 6 chữ số.' : isReset ? 'Nhập OTP trong email và mật khẩu mới.' : 'Đồng bộ trạm và tuyến yêu thích của bạn.'}
        />
        <Card style={styles.form}>
          {!isLogin && !isForgot && !isReset ? (
            <SearchField icon="person-outline" accessibilityLabel="Họ tên" placeholder="Họ tên" value={name} onChangeText={setName} autoComplete="name" />
          ) : null}
          <SearchField icon="mail-outline" accessibilityLabel="Email" placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
          {isReset ? (
            <>
              <SearchField icon="key-outline" accessibilityLabel="Mã OTP 6 chữ số" placeholder="OTP 6 chữ số" value={resetToken} onChangeText={(value) => setResetToken(value.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
              <Text style={[styles.infoText, { color: colors.muted, flex: 0 }]}>OTP có hiệu lực {otpValidityLabel(otpExpiresIn)} kể từ khi cấp, tối đa 5 lần nhập sai. Thời gian chờ gửi lại bên dưới không phải hạn OTP. Mã mới sẽ hủy mã cũ.</Text>
              <Button label={resendSeconds > 0 ? `Gửi lại OTP sau ${resendSeconds}s` : 'Gửi lại OTP'} variant="outline" disabled={submitting || resendSeconds > 0} onPress={() => void requestOtp()} />
            </>
          ) : null}
          {!isForgot ? (
            <>
              <SearchField icon="lock-closed-outline" accessibilityLabel="Mật khẩu" placeholder="Mật khẩu (tối thiểu 8 ký tự)" value={password} onChangeText={setPassword} secureTextEntry autoComplete={isLogin ? 'password' : 'new-password'} />
              {!isLogin ? (
                <SearchField icon="shield-checkmark-outline" accessibilityLabel="Xác nhận mật khẩu" placeholder="Xác nhận mật khẩu" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" />
              ) : null}
            </>
          ) : null}
          {error ? <ErrorState message={error} /> : null}
          <Button disabled={isForgot && resendSeconds > 0} label={isForgot ? (resendSeconds > 0 ? `Gửi OTP sau ${resendSeconds}s` : 'Gửi mã OTP') : isReset ? 'Đổi mật khẩu' : isLogin ? 'Đăng nhập' : 'Đăng ký'} icon={isForgot ? 'mail-outline' : isReset ? 'checkmark-circle-outline' : isLogin ? 'log-in-outline' : 'person-add-outline'} loading={submitting} onPress={() => void submit()} />
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

function InfoRow({ icon, text }: { icon: 'location-outline' | 'bus-outline' | 'cloud-done-outline' | 'moon-outline' | 'sunny-outline' | 'server-outline'; text: string }) {
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
  profile: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  profileName: { fontSize: 22, fontWeight: '800' },
  role: { fontSize: 12, fontWeight: '700' },
  groupLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: spacing.xl, marginBottom: spacing.sm },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: spacing.md },
  adminEntry: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: spacing.md, minHeight: 80 },
  signOut: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14, minHeight: 52 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
