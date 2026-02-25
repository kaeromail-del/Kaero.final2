import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';

export default function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { loadUser } = useAuthStore();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleChange = (val: string, idx: number) => {
    const newOtp = [...otp]; newOtp[idx] = val.slice(-1); setOtp(newOtp);
    if (val && idx < 5) refs.current[idx + 1]?.focus();
    if (newOtp.every(d => d !== '')) verifyOtp(newOtp.join(''));
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) refs.current[idx - 1]?.focus();
  };

  const verifyOtp = async (code: string) => {
    setLoading(true); setError('');
    try {
      const res = await authService.verifyOtp(phone, code);
      if (res.is_new_user) {
        router.replace({ pathname: '/(auth)/signup', params: { phone } });
      } else {
        await loadUser();
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Invalid code. Try again.');
      setOtp(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    try {
      await authService.requestOtp(phone); setResendTimer(60); setError('');
    } catch { setError('Failed to resend. Try again.'); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Verify Phone</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to{'\n'}<Text style={styles.phone}>{phone}</Text></Text>
        <View style={styles.otpRow}>
          {otp.map((digit, idx) => (
            <TextInput
              key={idx} ref={r => { refs.current[idx] = r; }}
              style={[styles.otpInput, digit && styles.otpFilled, !!error && styles.otpError]}
              value={digit} onChangeText={v => handleChange(v, idx)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, idx)}
              keyboardType="number-pad" maxLength={1} selectTextOnFocus autoFocus={idx === 0}
            />
          ))}
        </View>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Verifying...</Text>
          </View>
        )}
        <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0} style={[styles.resendBtn, resendTimer > 0 && { opacity: 0.4 }]}>
          <Text style={styles.resendText}>{resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: SPACING.xxl },
  back: { marginBottom: SPACING.xxl },
  backText: { color: COLORS.primary, fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 40 },
  phone: { color: COLORS.text, fontWeight: '700' },
  otpRow: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', marginBottom: SPACING.lg },
  otpInput: { width: 48, height: 60, borderWidth: 1.5, borderColor: '#DDD', borderRadius: RADIUS.md, textAlign: 'center', fontSize: 24, fontWeight: '700', color: COLORS.text },
  otpFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  otpError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, textAlign: 'center', marginBottom: SPACING.md },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: SPACING.md },
  loadingText: { color: COLORS.textSecondary },
  resendBtn: { alignItems: 'center', marginTop: SPACING.xl },
  resendText: { color: COLORS.primary, fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '600' },
});
