import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

// ─── Types ────────────────────────────────────────────────

interface Transaction {
  id: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  seller_name: string;
  listing_title: string;
  listing_id: string;
  agreed_price: number;
  status: string;
  payment_status: string;
  has_review?: boolean;
  buyer_review_id?: string | null;
  seller_review_id?: string | null;
}

// ─── Star rating labels ────────────────────────────────────

const RATING_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

// ─── Component ────────────────────────────────────────────

export default function LeaveReviewScreen() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // ── Load transaction ──────────────────────────────────

  const { data: transaction, isLoading, error } = useQuery<Transaction>({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      const { data } = await api.get(`/transactions/${transactionId}`);
      return data.transaction as Transaction;
    },
    enabled: !!transactionId,
  });

  // ── Submit review mutation ────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!transaction || !user) throw new Error('Missing data');
      const revieweeId =
        user.id === transaction.buyer_id
          ? transaction.seller_id
          : transaction.buyer_id;

      await api.post('/reviews', {
        transaction_id: transactionId,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || undefined,
      });
    },
    onSuccess: () => {
      Alert.alert('Review submitted!', 'Thank you for your feedback.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => {
      Alert.alert('Error', e?.response?.data?.error ?? 'Failed to submit review. Please try again.');
    },
  });

  // ── Derived state ─────────────────────────────────────

  const isBuyer = !!user && !!transaction && user.id === transaction.buyer_id;
  const revieweeName = transaction
    ? isBuyer
      ? transaction.seller_name
      : transaction.buyer_name
    : '';
  const revieweeRole = isBuyer ? 'seller' : 'buyer';

  // ── Guard: transaction not completed ─────────────────

  const isCompleted =
    transaction?.status === 'completed' ||
    transaction?.payment_status === 'released';

  // ── Guard: already reviewed ───────────────────────────

  const alreadyReviewed =
    transaction?.has_review === true ||
    (isBuyer
      ? !!transaction?.buyer_review_id
      : !!transaction?.seller_review_id);

  // ─── Loading state ─────────────────────────────────────

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Leave a Review' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </>
    );
  }

  if (error || !transaction) {
    return (
      <>
        <Stack.Screen options={{ title: 'Leave a Review' }} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.guardTitle}>Transaction not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // Guard: not completed
  if (!isCompleted) {
    return (
      <>
        <Stack.Screen options={{ title: 'Leave a Review' }} />
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Ionicons name="time-outline" size={56} color={COLORS.warning} />
          <Text style={styles.guardTitle}>Transaction not completed</Text>
          <Text style={styles.guardText}>
            This transaction must be completed before leaving a review.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // Guard: already reviewed
  if (alreadyReviewed) {
    return (
      <>
        <Stack.Screen options={{ title: 'Leave a Review' }} />
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
          <Text style={styles.guardTitle}>Already reviewed</Text>
          <Text style={styles.guardText}>
            You've already reviewed this transaction.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // ─── Main render ──────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Leave a Review' }} />

      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Custom header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBack}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave a Review</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Transaction summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <Ionicons name="bag-handle-outline" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.listingTitle} numberOfLines={2}>
              {transaction.listing_title}
            </Text>
            <Text style={styles.agreedPrice}>
              {Number(transaction.agreed_price).toLocaleString()} EGP
            </Text>
            <View style={styles.reviewingRow}>
              <Ionicons
                name={revieweeRole === 'seller' ? 'storefront-outline' : 'person-outline'}
                size={13}
                color={COLORS.textSecondary}
              />
              <Text style={styles.reviewingText}>
                Reviewing {revieweeRole}:{' '}
                <Text style={styles.revieweeName}>{revieweeName}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Star rating selector */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Your Rating *</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                style={styles.starButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={star <= rating ? '#FFD700' : '#D1D5DB'}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>{RATING_LABELS[rating - 1]}</Text>
          )}
          {rating === 0 && (
            <Text style={styles.ratingPlaceholder}>Tap a star to rate</Text>
          )}
        </View>

        {/* Comment TextInput */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Comments (optional)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience..."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            numberOfLines={5}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{comment.length}/500</Text>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (rating === 0 || submitMutation.isPending) && styles.submitButtonDisabled,
          ]}
          onPress={() => submitMutation.mutate()}
          disabled={rating === 0 || submitMutation.isPending}
          activeOpacity={0.8}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Review</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.back()}
          disabled={submitMutation.isPending}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  headerBack: {
    width: 40,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
  },

  // Guard screens
  guardTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  guardText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeightMD,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  backButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  backButtonText: {
    color: COLORS.textInverse,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    fontSize: TYPOGRAPHY.fontSizeMD,
  },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  summaryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryInfo: {
    flex: 1,
    gap: 4,
  },
  listingTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.text,
    lineHeight: TYPOGRAPHY.lineHeightMD,
  },
  agreedPrice: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
  },
  reviewingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  reviewingText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
  },
  revieweeName: {
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.text,
  },

  // Cards
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },

  // Stars
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  starButton: {
    padding: SPACING.xs,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFD700',
  },
  ratingPlaceholder: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },

  // Comment input
  commentInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // Submit button
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.xl,
    ...SHADOWS.md,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },

  // Skip button
  skipButton: {
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  skipButtonText: {
    color: COLORS.textTertiary,
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
});
