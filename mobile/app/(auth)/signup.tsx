import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { loadUser } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!fullName.trim()) { setError('Full name is required'); return; }
    setLoading(true); setError('');
    try {
      await api.patch('/users/me', { full_name: fullName.trim(), email: email.trim() || undefined, preferred_language: lang });
      await loadUser();
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to save profile');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Complete Profile</Text>
        <Text style={styles.subtitle}>Tell us a bit about yourself</Text>
        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input} value={fullName} onChangeText={t => { setFullName(t); setError(''); }}
              placeholder="Ahmed Mohamed" autoCapitalize="words" placeholderTextColor="#AAA"
            />
          </View>
          <View>
            <Text style={styles.label}>Email (optional)</Text>
            <TextInput
              style={styles.input} value={email} onChangeText={setEmail}
              placeholder="ahmed@email.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#AAA"
            />
          </View>
          <View>
            <Text style={styles.label}>Preferred Language</Text>
            <View style={styles.langRow}>
              {(['en', 'ar'] as const).map(l => (
                <TouchableOpacity
                  key={l} style={[styles.langBtn, lang === l && styles.langActive]} onPress={() => setLang(l)}
                >
                  <Text style={[styles.langText, lang === l && styles.langActiveText]}>
                    {l === 'en' ? '🇬🇧 English' : '🇪🇬 العربية'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity
            style={[styles.btn, (!fullName || loading) && styles.btnDisabled]}
            onPress={handleSave} disabled={!fullName || loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save & Continue</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', paddingHorizontal: SPACING.xxl },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, marginBottom: 32 },
  form: { gap: SPACING.xl },
  label: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: '#DDD', borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 54, fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  langRow: { flexDirection: 'row', gap: SPACING.md },
  langBtn: { flex: 1, height: 48, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  langActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  langText: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary },
  langActiveText: { color: COLORS.primary, fontWeight: '700' },
  errorText: { color: COLORS.error, fontSize: TYPOGRAPHY.fontSizeSM },
  btn: { height: 54, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold },
});
