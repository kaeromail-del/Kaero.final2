import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../../constants/theme';
import api from '../../../services/api';

// ─── Types ────────────────────────────────────────────────

interface Offer {
  id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_avatar?: string | null;
  amount: number;
  offered_price?: number;
  status: 'pending' | 'accepted' | 'declined' | 'countered';
  message?: string | null;
  created_at: string;
  counter_amount?: number | null;
  counter_price?: number | null;
}

interface Listing {
  id: string;
  title: string;
  price: number;
  condition: string;
}

// ─── Helpers ──────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Status badge config
const STATUS_CONFIG: Record<
  string,
  { label: string; textColor: string; bgColor: string }
> = {
  pending: {
    label: 'Pending',
    textColor: COLORS.warning,
    bgColor: '#FFF8EE',
  },
  accepted: {
    label: 'Accepted',
    textColor: COLORS.success,
    bgColor: '#F0FBF0',
  },
  declined: {
    label: 'Declined',
    textColor: COLORS.error,
    bgColor: '#FEF2F2',
  },
  countered: {
    label: 'Countered',
    textColor: COLORS.info,
    bgColor: '#EFF6FF',
  },
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

// ─── Avatar component ─────────────────────────────────────

function InitialsAvatar({ name }: { name: string }) {
  const initials = getInitials(name || '?');
  // Simple color based on first char code
  const hue = ((name || 'A').charCodeAt(0) * 37) % 360;
  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: `hsl(${hue}, 55%, 88%)` },
      ]}
    >
      <Text style={[styles.avatarText, { color: `hsl(${hue}, 45%, 35%)` }]}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Offer card component ─────────────────────────────────

interface OfferCardProps {
  offer: Offer;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCounter: (id: string, currentAmount: number) => void;
  isAccepting: boolean;
  isDeclining: boolean;
}

function OfferCard({
  offer,
  onAccept,
  onDecline,
  onCounter,
  isAccepting,
  isDeclining,
}: OfferCardProps) {
  const status = offer.status ?? 'pending';
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    textColor: COLORS.textSecondary,
    bgColor: COLORS.background,
  };
  const isPending = status === 'pending';
  const offerAmount = offer.amount ?? offer.offered_price ?? 0;
  const counterAmt = offer.counter_amount ?? offer.counter_price;

  return (
    <View style={styles.offerCard}>
      {/* Buyer row */}
      <View style={styles.buyerRow}>
        <InitialsAvatar name={offer.buyer_name ?? 'Buyer'} />
        <View style={styles.buyerInfo}>
          <Text style={styles.buyerName}>{offer.buyer_name ?? 'Anonymous'}</Text>
          <Text style={styles.timeText}>{timeAgo(offer.created_at)}</Text>
        </View>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
          <Text style={[styles.statusText, { color: config.textColor }]}>
            {config.label}
          </Text>
        </View>
      </View>

      {/* Offer amount */}
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Offer amount</Text>
        <Text style={styles.amountValue}>
          {Number(offerAmount).toLocaleString()} EGP
        </Text>
      </View>

      {/* Counter amount (if present) */}
      {counterAmt ? (
        <View style={styles.counterRow}>
          <Ionicons name="swap-horizontal-outline" size={14} color={COLORS.info} />
          <Text style={styles.counterLabel}>
            Your counter:{' '}
            <Text style={styles.counterValue}>
              {Number(counterAmt).toLocaleString()} EGP
            </Text>
          </Text>
        </View>
      ) : null}

      {/* Message */}
      {offer.message ? (
        <View style={styles.messageBox}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={13}
            color={COLORS.textSecondary}
          />
          <Text style={styles.messageText}>{offer.message}</Text>
        </View>
      ) : null}

      {/* Actions — only for pending offers */}
      {isPending && (
        <View style={styles.actionRow}>
          {/* Accept */}
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() =>
              Alert.alert(
                'Accept Offer',
                `Accept ${Number(offerAmount).toLocaleString()} EGP from ${offer.buyer_name}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Accept',
                    onPress: () => onAccept(offer.id),
                  },
                ]
              )
            }
            disabled={isAccepting || isDeclining}
            activeOpacity={0.8}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Decline */}
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() =>
              Alert.alert(
                'Decline Offer',
                'Are you sure you want to decline this offer?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: () => onDecline(offer.id),
                  },
                ]
              )
            }
            disabled={isAccepting || isDeclining}
            activeOpacity={0.8}
          >
            {isDeclining ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <>
                <Ionicons name="close" size={16} color={COLORS.error} />
                <Text style={styles.declineBtnText}>Decline</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Counter */}
          <TouchableOpacity
            style={styles.counterBtn}
            onPress={() => onCounter(offer.id, Number(offerAmount))}
            disabled={isAccepting || isDeclining}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal" size={16} color={COLORS.textSecondary} />
            <Text style={styles.counterBtnText}>Counter</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────

export default function ListingOffersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // ── Load listing ────────────────────────────────────

  const { data: listing } = useQuery<Listing>({
    queryKey: ['listing', id],
    queryFn: async () => {
      const { data } = await api.get(`/listings/${id}`);
      return data.listing as Listing;
    },
    enabled: !!id,
  });

  // ── Load offers ─────────────────────────────────────

  const {
    data: offers,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<Offer[]>({
    queryKey: ['listing-offers', id],
    queryFn: async () => {
      const { data } = await api.get(`/offers/listing/${id}`);
      return data.offers as Offer[];
    },
    enabled: !!id,
  });

  // ── Mutations ───────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: (offerId: string) =>
      api.patch(`/offers/${offerId}`, { action: 'accept' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-offers', id] });
      Alert.alert(
        'Offer accepted!',
        'The buyer will be notified. A transaction has been created.'
      );
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.error ?? 'Failed to accept offer'),
  });

  const declineMutation = useMutation({
    mutationFn: (offerId: string) =>
      api.patch(`/offers/${offerId}`, { action: 'decline' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-offers', id] });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.error ?? 'Failed to decline offer'),
  });

  const counterMutation = useMutation({
    mutationFn: ({
      offerId,
      counter_amount,
    }: {
      offerId: string;
      counter_amount: number;
    }) => api.patch(`/offers/${offerId}`, { action: 'counter', counter_amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-offers', id] });
      Alert.alert('Counter sent!', 'The buyer will be notified of your counter offer.');
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.error ?? 'Failed to send counter offer'),
  });

  // ── Counter offer prompt ────────────────────────────

  const handleCounter = useCallback(
    (offerId: string, currentAmount: number) => {
      Alert.prompt(
        'Counter Offer',
        `Enter your counter price (EGP). Buyer offered: ${currentAmount.toLocaleString()} EGP`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Counter',
            onPress: (value) => {
              const parsed = Number(value?.replace(/,/g, '').trim());
              if (!value || isNaN(parsed) || parsed <= 0) {
                Alert.alert('Invalid amount', 'Please enter a valid price.');
                return;
              }
              counterMutation.mutate({ offerId, counter_amount: parsed });
            },
          },
        ],
        'plain-text',
        String(Math.round(currentAmount * 1.05))
      );
    },
    [counterMutation]
  );

  // ── Render ──────────────────────────────────────────

  const offerList: Offer[] = offers ?? [];

  const listHeader = (
    <>
      {/* Listing header card */}
      {listing && (
        <View style={styles.listingHeaderCard}>
          <View style={styles.listingHeaderTop}>
            <Text style={styles.listingHeaderTitle} numberOfLines={2}>
              {listing.title}
            </Text>
            <Text style={styles.listingHeaderPrice}>
              {Number(listing.price).toLocaleString()} EGP
            </Text>
          </View>
          <View style={styles.listingHeaderMeta}>
            <View style={styles.metaChip}>
              <Ionicons name="pricetag-outline" size={12} color={COLORS.textSecondary} />
              <Text style={styles.metaChipText}>
                {CONDITION_LABELS[listing.condition] ?? listing.condition}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="layers-outline" size={12} color={COLORS.textSecondary} />
              <Text style={styles.metaChipText}>
                {offerList.length} offer{offerList.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>
      )}

      {offerList.length > 0 && (
        <Text style={styles.offersHeading}>All Offers</Text>
      )}
    </>
  );

  const emptyComponent = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="mail-open-outline" size={48} color={COLORS.border} />
      </View>
      <Text style={styles.emptyTitle}>No offers yet</Text>
      <Text style={styles.emptyText}>
        No offers yet. Boost your listing to get more visibility!
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Listing Offers' }} />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Custom header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Listing Offers</Text>
          <View style={{ width: 32 }} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList<Offer>
            data={offerList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              offerList.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }
            ListHeaderComponent={listHeader}
            ListEmptyComponent={emptyComponent}
            renderItem={({ item }) => (
              <OfferCard
                offer={item}
                onAccept={(offerId) => acceptMutation.mutate(offerId)}
                onDecline={(offerId) => declineMutation.mutate(offerId)}
                onCounter={handleCounter}
                isAccepting={
                  acceptMutation.isPending &&
                  acceptMutation.variables === item.id
                }
                isDeclining={
                  declineMutation.isPending &&
                  declineMutation.variables === item.id
                }
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          />
        )}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
  },

  // List
  listContent: {
    padding: SPACING.md,
    paddingBottom: 48,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Listing header card
  listingHeaderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  listingHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  listingHeaderTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.text,
    lineHeight: TYPOGRAPHY.lineHeightMD,
  },
  listingHeaderPrice: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
    flexShrink: 0,
  },
  listingHeaderMeta: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  metaChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },

  // Offers heading
  offersHeading: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  // Offer card
  offerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.sm,
    gap: SPACING.sm,
  },

  // Buyer row
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  buyerInfo: {
    flex: 1,
    gap: 2,
  },
  buyerName: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.text,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },

  // Status badge
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },

  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
  },
  amountLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
  },
  amountValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
  },

  // Counter row
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  counterLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.info,
  },
  counterValue: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },

  // Message
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  messageText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeightSM,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  acceptBtn: {
    flex: 1.4,
    height: 44,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  declineBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  declineBtnText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  counterBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  counterBtnText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeightMD,
  },
});
