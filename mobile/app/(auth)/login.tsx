import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { authService } from '../../services/auth.service';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePhone = (p: string) => /^01[0125][0-9]{8}$/.test(p.replace(/\s/g, ''));

  const handleSubmit = async () => {
    const clean = phone.replace(/\s/g, '');
    if (!validatePhone(clean)) { setError('Enter a valid Egyptian phone (e.g. 01012345678)'); return; }
    setError(''); setLoading(true);
    try {
      await authService.requestOtp(clean);
      router.push({ pathname: '/(auth)/otp', params: { phone: clean } });
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to send OTP. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}><Text style={styles.logoText}>K</Text></View>
          <Text style={styles.appName}>Kaero</Text>
          <Text style={styles.tagline}>Egypt's Marketplace</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.inputRow, !!error && styles.inputError]}>
            <Text style={styles.flag}>🇪🇬 +20</Text>
            <TextInput
              style={styles.input} value={phone} onChangeText={t => { setPhone(t); setError(''); }}
              placeholder="01012345678" keyboardType="phone-pad" maxLength={11} autoFocus
              placeholderTextColor={COLORS.iconDefault}
            />
          </View>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity
            style={[styles.btn, (!phone || loading) && styles.btnDisabled]}
            onPress={handleSubmit} disabled={!phone || loading} activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Get OTP</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.terms}>
          By continuing, you agree to Kaero's{'\n'}
          <Text style={styles.link}>Terms of Service</Text> and <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.xxl },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { color: '#fff', fontSize: 40, fontWeight: '800' },
  appName: { fontSize: 32, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  form: { gap: SPACING.md },
  label: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 54 },
  inputError: { borderColor: COLORS.error },
  flag: { fontSize: 14, color: COLORS.textSecondary, marginRight: SPACING.sm },
  input: { flex: 1, fontSize: TYPOGRAPHY.fontSizeLG, color: COLORS.text, letterSpacing: 1 },
  errorText: { color: COLORS.error, fontSize: TYPOGRAPHY.fontSizeSM },
  btn: { height: 54, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold },
  terms: { textAlign: 'center', color: COLORS.iconDefault, fontSize: 12, marginTop: SPACING.xxl, lineHeight: 18 },
  link: { color: COLORS.primary, fontWeight: '600' },
});
