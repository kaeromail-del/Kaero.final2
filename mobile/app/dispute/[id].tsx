import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { transactionService } from '../../services/transaction.service';
import { uploadService } from '../../services/upload.service';

// ─── Reason options ─────────────────────────────────────────

type DisputeReason =
  | 'item_not_received'
  | 'item_not_as_described'
  | 'payment_issue'
  | 'fraud'
  | 'other';

const REASONS: { value: DisputeReason; label: string; icon: string; description: string }[] = [
  {
    value: 'item_not_received',
    label: 'Item Not Received',
    icon: 'cube-outline',
    description: 'You paid but did not receive the item.',
  },
  {
    value: 'item_not_as_described',
    label: 'Item Not as Described',
    icon: 'alert-circle-outline',
    description: 'The item differs significantly from the listing.',
  },
  {
    value: 'payment_issue',
    label: 'Payment Issue',
    icon: 'card-outline',
    description: 'There is a problem with the payment or escrow.',
  },
  {
    value: 'fraud',
    label: 'Suspected Fraud',
    icon: 'shield-outline',
    description: 'You believe the other party is acting fraudulently.',
  },
  {
    value: 'other',
    label: 'Other',
    icon: 'help-circle-outline',
    description: 'Other issue not listed above.',
  },
];

// ─── Component ───────────────────────────────────────────────

export default function DisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!reason) throw new Error('Select a reason');
      return transactionService.openDisputeWithReason(id, reason, details.trim(), evidence);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      Alert.alert(
        'Dispute Opened',
        'Our team will review your case within 24–48 hours. You can track status in the transaction screen.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? e.message ?? 'Failed to open dispute'),
  });

  const pickEvidence = async () => {
    if (evidence.length >= 5) {
      Alert.alert('Max 5 photos', 'You can upload up to 5 evidence photos.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const url = await uploadService.uploadImage(result.assets[0].uri);
      setEvidence(prev => [...prev, url]);
    } catch {
      Alert.alert('Upload failed', 'Could not upload image. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeEvidence = (index: number) => {
    setEvidence(prev => prev.filter((_, i) => i !== index));
  };

  const canSubmit = !!reason && details.trim().length >= 10 && !mutation.isPending;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Open Dispute</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Warning banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="information-circle" size={18} color="#D97706" />
          <Text style={styles.warningText}>
            Disputes are reviewed by the Kaero team. Filing a false dispute may result in account suspension.
          </Text>
        </View>

        {/* Reason picker */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reason for Dispute</Text>
          {REASONS.map(r => (
            <TouchableOpacity
              key={r.value}
              style={[styles.reasonRow, reason === r.value && styles.reasonRowActive]}
              onPress={() => setReason(r.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.reasonIcon, reason === r.value && styles.reasonIconActive]}>
                <Ionicons name={r.icon as any} size={20} color={reason === r.value ? '#fff' : COLORS.textSecondary} />
              </View>
              <View style={styles.reasonInfo}>
                <Text style={[styles.reasonLabel, reason === r.value && styles.reasonLabelActive]}>{r.label}</Text>
                <Text style={styles.reasonDesc}>{r.description}</Text>
              </View>
              <View style={[styles.radio, reason === r.value && styles.radioActive]}>
                {reason === r.value && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Describe the Issue</Text>
          <Text style={styles.inputHint}>Minimum 10 characters. Be specific and factual.</Text>
          <TextInput
            style={styles.detailsInput}
            value={details}
            onChangeText={setDetails}
            placeholder="Explain what happened in detail..."
            placeholderTextColor="#B0B0B0"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{details.length}/1000</Text>
        </View>

        {/* Evidence photos */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Evidence Photos</Text>
          <Text style={styles.inputHint}>Optional but recommended. Up to 5 photos (receipts, damage, chat screenshots).</Text>

          <View style={styles.evidenceGrid}>
            {evidence.map((uri, i) => (
              <View key={i} style={styles.evidenceThumb}>
                <Image source={{ uri }} style={styles.evidenceImg} />
                <TouchableOpacity style={styles.evidenceRemove} onPress={() => removeEvidence(i)}>
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}

            {evidence.length < 5 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickEvidence} disabled={uploading}>
                {uploading
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : (
                    <>
                      <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                      <Text style={styles.addPhotoText}>Add Photo</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={() => {
            Alert.alert(
              'Submit Dispute',
              'Are you sure you want to open a dispute? This will pause the transaction until resolved.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Submit', style: 'destructive', onPress: () => mutation.mutate() },
              ],
            );
          }}
          disabled={!canSubmit}
        >
          {mutation.isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <>
                <Ionicons name="warning-outline" size={20} color="#fff" />
                <Text style={styles.submitText}>Submit Dispute</Text>
              </>
            )
          }
        </TouchableOpacity>

        <Text style={styles.footer}>
          Kaero support responds within 24–48 hours on business days.
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

  warningBanner: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    backgroundColor: '#FFFBEB', borderRadius: RADIUS.md, padding: SPACING.md,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.lg, ...SHADOWS.sm },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm,
  },

  // Reason rows
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  reasonRowActive: { backgroundColor: COLORS.primaryLight, marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg, borderRadius: 0, borderBottomColor: 'transparent' },
  reasonIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  reasonIconActive: { backgroundColor: COLORS.primary },
  reasonInfo: { flex: 1 },
  reasonLabel: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text },
  reasonLabelActive: { color: COLORS.primary },
  reasonDesc: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2, lineHeight: 16 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CCC', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  // Details
  inputHint: { fontSize: 12, color: COLORS.textTertiary, marginBottom: SPACING.sm },
  detailsInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: RADIUS.sm,
    padding: SPACING.md, fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text,
    minHeight: 120, lineHeight: 20,
  },
  charCount: { fontSize: 11, color: COLORS.textTertiary, textAlign: 'right', marginTop: SPACING.xs },

  // Evidence
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  evidenceThumb: { width: 80, height: 80, borderRadius: RADIUS.sm, overflow: 'hidden', position: 'relative' },
  evidenceImg: { width: '100%', height: '100%' },
  evidenceRemove: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
  },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  addPhotoText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },

  // Submit
  submitBtn: {
    height: 54, backgroundColor: COLORS.error, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },

  footer: { textAlign: 'center', fontSize: 12, color: COLORS.textTertiary, lineHeight: 18, paddingHorizontal: SPACING.lg },
});
