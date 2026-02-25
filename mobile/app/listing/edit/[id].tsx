import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../../constants/theme';
import api from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
type Condition = typeof CONDITIONS[number];

const CONDITION_LABELS: Record<Condition, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

const STATUSES = ['active', 'sold'] as const;
type ListingStatus = typeof STATUSES[number];

const STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Active',
  sold: 'Sold',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Form state — populated after listing loads
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [price, setPrice]               = useState('');
  const [condition, setCondition]       = useState<Condition>('good');
  const [status, setStatus]             = useState<ListingStatus>('active');
  const [initialised, setInitialised]   = useState(false);

  // ── Load listing ──────────────────────────────────────────────────────────

  const {
    data: listing,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      const { data } = await api.get(`/listings/${id}`);
      return data.listing;
    },
    enabled: !!id,
  });

  // Populate form once listing is fetched (run once)
  React.useEffect(() => {
    if (listing && !initialised) {
      setTitle(listing.user_edited_title ?? '');
      setDescription(listing.user_edited_description ?? '');
      setPrice(String(listing.final_price ?? ''));
      setCondition((listing.condition as Condition) ?? 'good');
      setStatus((listing.status as ListingStatus) ?? 'active');
      setInitialised(true);
    }
  }, [listing, initialised]);

  // ── Save mutation ──────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: (payload: {
      user_edited_title: string;
      user_edited_description: string;
      final_price: number;
      condition: Condition;
      status: ListingStatus;
    }) => api.patch(`/listings/${id}`, payload).then((r) => r.data.listing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', id] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      Alert.alert('Updated!', 'Your listing has been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.error ?? 'Failed to update listing'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title for your listing.');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert('Invalid price', 'Please enter a valid price greater than 0.');
      return;
    }
    updateMutation.mutate({
      user_edited_title: title.trim(),
      user_edited_description: description.trim(),
      final_price: Number(price),
      condition,
      status,
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading || (listing && !initialised)) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Edit Listing',
            headerShown: true,
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: COLORS.primary,
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (isError || !listing) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Edit Listing',
            headerShown: true,
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: COLORS.primary,
          }}
        />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Failed to load listing</Text>
          <Text style={styles.errorSub}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // ── Authorization guard ────────────────────────────────────────────────────

  if (listing.seller_id !== user?.id) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Edit Listing',
            headerShown: true,
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: COLORS.primary,
          }}
        />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.errorTitle}>Not authorized</Text>
          <Text style={styles.errorSub}>You can only edit your own listings.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Listing',
          headerShown: true,
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: COLORS.primary,
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Title ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What are you selling?"
              maxLength={200}
              placeholderTextColor={COLORS.textTertiary}
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{title.length}/200</Text>
          </View>

          {/* ── Description ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the item's condition, specs, reason for selling..."
              multiline
              maxLength={5000}
              placeholderTextColor={COLORS.textTertiary}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/5000</Text>
          </View>

          {/* ── Price ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Price (EGP) *</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.input, styles.priceInput]}
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={COLORS.textTertiary}
                returnKeyType="done"
              />
              <Text style={styles.currency}>EGP</Text>
            </View>
          </View>

          {/* ── Condition ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.pillRow}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, condition === c && styles.pillActive]}
                  onPress={() => setCondition(c)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, condition === c && styles.pillTextActive]}>
                    {CONDITION_LABELS[c]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Status ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.pillRow}>
              {STATUSES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.pill,
                    status === s && styles.pillActive,
                    s === 'sold' && status === s && styles.pillSold,
                  ]}
                  onPress={() => setStatus(s)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      status === s && styles.pillTextActive,
                    ]}
                  >
                    {STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {status === 'sold' && (
              <View style={styles.soldWarning}>
                <Ionicons name="information-circle-outline" size={14} color={COLORS.warning} />
                <Text style={styles.soldWarningText}>
                  Marking as sold will hide this listing from search results.
                </Text>
              </View>
            )}
          </View>

          {/* ── Save button ── */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, updateMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
              activeOpacity={0.85}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Center (loading / error / auth) ──
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xxl,
    gap: SPACING.sm,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  errorSub: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  backBtnText: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },

  // ── Sections ──
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },

  // ── Inputs ──
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  textArea: {
    minHeight: 130,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'right',
    marginTop: 4,
  },

  // ── Price ──
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  priceInput: {
    flex: 1,
  },
  currency: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textSecondary,
    minWidth: 36,
  },

  // ── Pills (condition + status) ──
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  pillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  pillSold: {
    borderColor: COLORS.error,
    backgroundColor: '#FDECEA',
  },
  pillText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textSecondary,
  },
  pillTextActive: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },

  // ── Status warning ──
  soldWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    backgroundColor: '#FFF8E1',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  soldWarningText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.warning,
    lineHeight: TYPOGRAPHY.lineHeightSM,
  },

  // ── Footer / Save button ──
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 56,
    ...SHADOWS.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
});
