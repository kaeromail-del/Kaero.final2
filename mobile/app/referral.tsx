import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Share, Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../constants/theme';
import { referralService } from '../services/referral.service';

// ─── How it works steps ───────────────────────────────────

const HOW_IT_WORKS = [
  { icon: 'share-social-outline', label: 'Share your code', desc: 'Send your unique referral code to a friend.' },
  { icon: 'person-add-outline',   label: 'Friend joins',    desc: 'They sign up and enter your code.' },
  { icon: 'gift-outline',         label: 'Both earn 50 EGP', desc: 'You and your friend each get 50 EGP credits instantly.' },
  { icon: 'trophy-outline',       label: 'Bonus 100 EGP',   desc: 'Earn an extra 100 EGP when your friend completes their first transaction.' },
];

// ─── Component ────────────────────────────────────────────

export default function ReferralScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [applyCode, setApplyCode] = useState('');
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['referral'],
    queryFn: () => referralService.getMyReferral(),
  });

  const applyMutation = useMutation({
    mutationFn: () => referralService.applyCode(applyCode.trim().toUpperCase()),
    onSuccess: (res) => {
      Alert.alert('Code Applied!', res.message);
      setApplyCode('');
      refetch();
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Invalid code'),
  });

  const handleCopy = () => {
    if (!data?.referral_code) return;
    Clipboard.setString(data.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!data?.referral_code) return;
    await Share.share({
      message: `Join Kaero — Egypt's trusted local marketplace! Use my code ${data.referral_code} when you sign up and we both get 50 EGP credits. Download: https://kaero.app`,
      title: 'Join Kaero and earn credits!',
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="gift" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.heroTitle}>Earn up to 150 EGP{'\n'}per friend you invite</Text>
          <Text style={styles.heroSub}>
            50 EGP when they join + 100 EGP when they complete their first transaction
          </Text>

          {/* Credits balance */}
          {isLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.md }} />
          ) : (
            <View style={styles.creditsRow}>
              <View style={styles.creditsBox}>
                <Text style={styles.creditsAmount}>{data?.referral_credits ?? 0}</Text>
                <Text style={styles.creditsLabel}>EGP Credits</Text>
              </View>
              <View style={styles.creditsDivider} />
              <View style={styles.creditsBox}>
                <Text style={styles.creditsAmount}>{data?.total_referred ?? 0}</Text>
                <Text style={styles.creditsLabel}>Friends Invited</Text>
              </View>
            </View>
          )}
        </View>

        {/* Your referral code */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Referral Code</Text>
          {isLoading ? (
            <View style={styles.codeSkeleton} />
          ) : (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.codeText} selectable>{data?.referral_code ?? '—'}</Text>
                <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color={copied ? COLORS.success : COLORS.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Share with Friends</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Apply a code */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Have a Friend's Code?</Text>
          <Text style={styles.applyHint}>Enter their referral code to earn 50 EGP credits.</Text>
          <View style={styles.applyRow}>
            <TextInput
              style={styles.applyInput}
              value={applyCode}
              onChangeText={t => setApplyCode(t.toUpperCase())}
              placeholder="e.g. A1B2C3D4"
              placeholderTextColor="#B0B0B0"
              autoCapitalize="characters"
              maxLength={12}
            />
            <TouchableOpacity
              style={[styles.applyBtn, (!applyCode.trim() || applyMutation.isPending) && styles.applyBtnDisabled]}
              onPress={() => applyMutation.mutate()}
              disabled={!applyCode.trim() || applyMutation.isPending}
            >
              {applyMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.applyBtnText}>Apply</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* How it works */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          {HOW_IT_WORKS.map((step, i) => (
            <View key={i} style={styles.howRow}>
              <View style={styles.howIconWrap}>
                <Ionicons name={step.icon as any} size={22} color={COLORS.primary} />
                {i < HOW_IT_WORKS.length - 1 && <View style={styles.howLine} />}
              </View>
              <View style={styles.howContent}>
                <Text style={styles.howLabel}>{step.label}</Text>
                <Text style={styles.howDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Friends list */}
        {(data?.friends?.length ?? 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Friends Invited ({data?.friends.length})</Text>
            {data?.friends.map((f, i) => (
              <View key={i} style={styles.friendRow}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarText}>
                    {(f.full_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{f.full_name || 'Anonymous'}</Text>
                  <Text style={styles.friendDate}>
                    Joined {new Date(f.created_at).toLocaleDateString('en-EG', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={[styles.friendBadge, f.has_transacted && styles.friendBadgeActive]}>
                  <Text style={[styles.friendBadgeText, f.has_transacted && styles.friendBadgeTextActive]}>
                    {f.has_transacted ? '+150 EGP' : '+50 EGP'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Terms */}
        <Text style={styles.terms}>
          Credits can be used to reduce platform fees on future transactions. Credits expire after 12 months.
          One referral code per account. Kaero reserves the right to modify or cancel the referral program.
        </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', ...SHADOWS.sm,
  },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  scroll: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 60 },

  // Hero
  heroCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: SPACING.xl,
    alignItems: 'center', gap: SPACING.sm,
  },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm,
  },
  heroTitle: { fontSize: TYPOGRAPHY.fontSizeXXL, fontWeight: '900', color: COLORS.primaryDark, textAlign: 'center', lineHeight: 30 },
  heroSub: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.primary, textAlign: 'center', lineHeight: 18 },
  creditsRow: { flexDirection: 'row', gap: SPACING.lg, alignItems: 'center', backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.md, width: '100%', justifyContent: 'center', ...SHADOWS.sm },
  creditsBox: { alignItems: 'center', flex: 1 },
  creditsAmount: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  creditsLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  creditsDivider: { width: 1, height: 36, backgroundColor: '#E0E0E0' },

  // Code
  card: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.lg, ...SHADOWS.sm },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md,
  },
  codeSkeleton: { height: 56, borderRadius: RADIUS.sm, backgroundColor: '#F0F0F0', marginBottom: SPACING.md },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.lg,
    marginBottom: SPACING.md, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
  },
  codeText: { fontSize: 26, fontWeight: '900', color: COLORS.primary, letterSpacing: 4 },
  copyBtn: { padding: SPACING.xs },
  shareBtn: {
    height: 50, backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  shareBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },

  // Apply
  applyHint: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  applyRow: { flexDirection: 'row', gap: SPACING.sm },
  applyInput: {
    flex: 1, height: 48, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '700',
    color: COLORS.text, letterSpacing: 2,
  },
  applyBtn: {
    height: 48, paddingHorizontal: SPACING.lg, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center',
  },
  applyBtnDisabled: { opacity: 0.45 },
  applyBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },

  // How it works
  howRow: { flexDirection: 'row', gap: SPACING.md, minHeight: 56 },
  howIconWrap: { alignItems: 'center', width: 36 },
  howLine: { flex: 1, width: 2, backgroundColor: COLORS.primaryLight, marginTop: 4 },
  howContent: { flex: 1, paddingBottom: SPACING.md },
  howLabel: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.text },
  howDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },

  // Friends
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '700', color: COLORS.primary },
  friendInfo: { flex: 1 },
  friendName: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '600', color: COLORS.text },
  friendDate: { fontSize: 12, color: COLORS.textTertiary },
  friendBadge: { backgroundColor: '#F5F5F5', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 },
  friendBadgeActive: { backgroundColor: '#ECFDF5' },
  friendBadgeText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' },
  friendBadgeTextActive: { color: COLORS.success },

  terms: { fontSize: 11, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 16, paddingHorizontal: SPACING.md },
});
