import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../constants/theme';
import { uploadService } from '../services/upload.service';
import api from '../services/api';

// ─── Photo slot ──────────────────────────────────────────────

interface PhotoSlotProps {
  label: string;
  hint: string;
  icon: string;
  uri: string | null;
  onPress: () => void;
  uploading: boolean;
}

function PhotoSlot({ label, hint, icon, uri, onPress, uploading }: PhotoSlotProps) {
  return (
    <TouchableOpacity style={styles.slot} onPress={onPress} disabled={uploading} activeOpacity={0.8}>
      {uri ? (
        <View style={styles.slotFilled}>
          <Image source={{ uri }} style={styles.slotImg} resizeMode="cover" />
          <View style={styles.slotDone}>
            <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
          </View>
          <Text style={styles.slotFilledLabel}>{label}</Text>
        </View>
      ) : (
        <View style={styles.slotEmpty}>
          {uploading
            ? <ActivityIndicator size="large" color={COLORS.primary} />
            : <Ionicons name={icon as any} size={36} color="#C0C0C0" />
          }
          <Text style={styles.slotLabel}>{label}</Text>
          <Text style={styles.slotHint}>{hint}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Steps ───────────────────────────────────────────────────

type Step = 'intro' | 'docs' | 'selfie' | 'review' | 'done';

export default function VerifyIdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('intro');
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      await api.post('/users/me/id-verify', {
        id_front_url: idFrontUri,
        id_back_url: idBackUri,
        selfie_url: selfieUri,
      });
    },
    onSuccess: () => setStep('done'),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Submission failed. Try again.'),
  });

  const pickImage = async (slot: string, setter: (uri: string) => void, useCamera = false) => {
    const permFn = useCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== 'granted') {
      Alert.alert('Permission needed', useCamera ? 'Camera access is required.' : 'Photo library access is required.');
      return;
    }
    const launchFn = useCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launchFn({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      ...(useCamera ? { aspect: [4, 3] as [number, number] } : {}),
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingSlot(slot);
    try {
      const url = await uploadService.uploadImage(result.assets[0].uri);
      setter(url);
    } catch {
      Alert.alert('Upload failed', 'Could not upload image. Try again.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const pickOrCapture = (slot: string, setter: (uri: string) => void) => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Take Photo', onPress: () => pickImage(slot, setter, true) },
      { text: 'Choose from Library', onPress: () => pickImage(slot, setter, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Screens ──────────────────────────────────────────────

  if (step === 'done') {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark-circle" size={72} color={COLORS.success} />
        </View>
        <Text style={styles.doneTitle}>Documents Submitted!</Text>
        <Text style={styles.doneDesc}>
          Our team will review your ID within 1–2 business days. You'll receive a notification once verified.
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)' as any)}>
          <Text style={styles.doneBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 'intro' ? router.back() : setStep(step === 'selfie' ? 'docs' : step === 'review' ? 'selfie' : 'intro')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ID Verification</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progress}>
        {(['intro', 'docs', 'selfie', 'review'] as Step[]).map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              ['intro', 'docs', 'selfie', 'review'].indexOf(step) >= i && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Intro ── */}
        {step === 'intro' && (
          <View style={styles.introWrap}>
            <View style={styles.introBadge}>
              <Ionicons name="shield-checkmark" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.introTitle}>Verify Your Identity</Text>
            <Text style={styles.introDesc}>
              Get a verified badge that builds trust with buyers and sellers. You'll need:
            </Text>
            <View style={styles.requirementList}>
              {[
                { icon: 'card-outline', label: 'Front of National ID' },
                { icon: 'card-outline', label: 'Back of National ID' },
                { icon: 'person-circle-outline', label: 'A selfie holding your ID' },
              ].map((r) => (
                <View key={r.label} style={styles.requirementRow}>
                  <View style={styles.requirementDot}>
                    <Ionicons name={r.icon as any} size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.requirementLabel}>{r.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.privacyNote}>
              <Ionicons name="lock-closed-outline" size={14} color={COLORS.textTertiary} />
              <Text style={styles.privacyText}>
                Your documents are encrypted and only used for identity verification. They are not shared with other users.
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('docs')}>
              <Text style={styles.primaryBtnText}>Start Verification</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Document photos ── */}
        {step === 'docs' && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>National ID Photos</Text>
            <Text style={styles.stepDesc}>
              Ensure the ID is fully visible, well-lit, and all text is readable. Avoid glare and shadows.
            </Text>

            <View style={styles.slotsRow}>
              <PhotoSlot
                label="Front"
                hint="Show full front side"
                icon="card-outline"
                uri={idFrontUri}
                onPress={() => pickOrCapture('front', setIdFrontUri)}
                uploading={uploadingSlot === 'front'}
              />
              <PhotoSlot
                label="Back"
                hint="Show full back side"
                icon="card-outline"
                uri={idBackUri}
                onPress={() => pickOrCapture('back', setIdBackUri)}
                uploading={uploadingSlot === 'back'}
              />
            </View>

            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Tips for a good photo:</Text>
              {[
                'Place ID on a dark background',
                'Make sure all 4 corners are visible',
                'No blur or glare on the ID',
                'Do not cover any part of the ID',
              ].map((t) => (
                <View key={t} style={styles.tipRow}>
                  <View style={styles.tipDot} />
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (!idFrontUri || !idBackUri) && styles.primaryBtnDisabled]}
              onPress={() => setStep('selfie')}
              disabled={!idFrontUri || !idBackUri}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Selfie ── */}
        {step === 'selfie' && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>Selfie with ID</Text>
            <Text style={styles.stepDesc}>
              Hold your National ID next to your face so both are clearly visible in the photo.
            </Text>

            <View style={styles.selfieExample}>
              <View style={styles.selfieExampleInner}>
                <Ionicons name="person-circle-outline" size={60} color="#CCC" />
                <Ionicons name="card-outline" size={36} color="#CCC" style={styles.selfieCardIcon} />
              </View>
              <Text style={styles.selfieExampleLabel}>Example: face + ID card visible</Text>
            </View>

            <PhotoSlot
              label="Selfie with ID"
              hint="Face + ID card both visible"
              icon="person-circle-outline"
              uri={selfieUri}
              onPress={() => pickOrCapture('selfie', setSelfieUri)}
              uploading={uploadingSlot === 'selfie'}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, !selfieUri && styles.primaryBtnDisabled, { marginTop: SPACING.md }]}
              onPress={() => setStep('review')}
              disabled={!selfieUri}
            >
              <Text style={styles.primaryBtnText}>Review</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Review & submit ── */}
        {step === 'review' && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>Review & Submit</Text>
            <Text style={styles.stepDesc}>
              Make sure all photos are clear and readable before submitting.
            </Text>

            <View style={styles.reviewGrid}>
              {[
                { label: 'Front of ID', uri: idFrontUri, setter: setIdFrontUri, slot: 'front' },
                { label: 'Back of ID', uri: idBackUri, setter: setIdBackUri, slot: 'back' },
                { label: 'Selfie with ID', uri: selfieUri, setter: setSelfieUri, slot: 'selfie' },
              ].map((item) => (
                <View key={item.label} style={styles.reviewItem}>
                  <Image source={{ uri: item.uri! }} style={styles.reviewImg} resizeMode="cover" />
                  <View style={styles.reviewItemFooter}>
                    <Text style={styles.reviewItemLabel}>{item.label}</Text>
                    <TouchableOpacity onPress={() => pickOrCapture(item.slot, item.setter as (uri: string) => void)}>
                      <Text style={styles.retakeText}>Retake</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.consentBox}>
              <Ionicons name="lock-closed" size={16} color={COLORS.textTertiary} />
              <Text style={styles.consentText}>
                By submitting, you consent to Kaero processing your identity documents for verification purposes in accordance with our Privacy Policy.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Submit for Verification</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', ...SHADOWS.sm,
  },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },

  progress: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: SPACING.sm, backgroundColor: '#fff' },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0E0E0' },
  progressDotActive: { backgroundColor: COLORS.primary, width: 24 },

  scroll: { padding: SPACING.lg, paddingBottom: 60 },

  // Intro
  introWrap: { alignItems: 'center', gap: SPACING.lg },
  introBadge: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  introTitle: { fontSize: TYPOGRAPHY.fontSizeXXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text, textAlign: 'center' },
  introDesc: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  requirementList: { width: '100%', gap: SPACING.sm },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  requirementDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  requirementLabel: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text, fontWeight: '500' },
  privacyNote: { flexDirection: 'row', gap: SPACING.xs, alignItems: 'flex-start', backgroundColor: '#F5F5F5', borderRadius: RADIUS.sm, padding: SPACING.sm },
  privacyText: { flex: 1, fontSize: 12, color: COLORS.textTertiary, lineHeight: 16 },

  // Steps
  stepWrap: { gap: SPACING.md },
  stepTitle: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  stepDesc: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, lineHeight: 22 },

  // Slots
  slotsRow: { flexDirection: 'row', gap: SPACING.md },
  slot: { flex: 1 },
  slotEmpty: {
    height: 140, borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    backgroundColor: '#FAFAFA',
  },
  slotFilled: {
    height: 140, borderRadius: RADIUS.md, overflow: 'hidden', position: 'relative',
  },
  slotImg: { width: '100%', height: '100%' },
  slotDone: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 14 },
  slotLabel: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.textSecondary },
  slotFilledLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
    textAlign: 'center', fontSize: 12, paddingVertical: 4, fontWeight: '600',
  },
  slotHint: { fontSize: 11, color: '#B0B0B0', textAlign: 'center' },

  // Tips
  tipsCard: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs, ...SHADOWS.sm },
  tipsTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  tipDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.primary },
  tipText: { fontSize: 13, color: COLORS.textSecondary },

  // Selfie example
  selfieExample: { backgroundColor: '#F5F5F5', borderRadius: RADIUS.md, padding: SPACING.lg, alignItems: 'center', gap: SPACING.xs },
  selfieExampleInner: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  selfieCardIcon: { marginBottom: 8 },
  selfieExampleLabel: { fontSize: 12, color: COLORS.textTertiary },

  // Review
  reviewGrid: { gap: SPACING.md },
  reviewItem: { backgroundColor: '#fff', borderRadius: RADIUS.md, overflow: 'hidden', ...SHADOWS.sm },
  reviewImg: { width: '100%', height: 180 },
  reviewItemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.sm },
  reviewItemLabel: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.text },
  retakeText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.primary, fontWeight: '600' },
  consentBox: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', backgroundColor: '#F5F5F5', borderRadius: RADIUS.sm, padding: SPACING.sm },
  consentText: { flex: 1, fontSize: 12, color: COLORS.textTertiary, lineHeight: 16 },

  // Buttons
  primaryBtn: {
    height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    width: '100%',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },
  submitBtn: {
    height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  submitBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },

  // Done
  doneIcon: { marginBottom: SPACING.lg },
  doneTitle: { fontSize: TYPOGRAPHY.fontSizeXXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text, marginBottom: SPACING.sm, textAlign: 'center' },
  doneDesc: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
  doneBtn: {
    height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },
});
