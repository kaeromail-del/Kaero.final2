import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  CONDITION_COLORS,
  CONDITION_LABELS,
} from '../../constants/theme';
import api from '../../services/api';
import { listingService } from '../../services/listing.service';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/ui/Avatar';
import { Stars } from '../../components/ui/Stars';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = SPACING.sm;
const CARD_W = (SCREEN_W - SPACING.lg * 2 - CARD_GAP) / 2;

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function formatMemberSince(dateStr?: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-EG', {
    month: 'long',
    year: 'numeric',
  });
}

function formatReviewDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────
// Inline listing card (grid cell)
// ─────────────────────────────────────────────────

interface SellerListingItem {
  id: string;
  user_edited_title: string;
  final_price: number;
  primary_image_url?: string | null;
  condition: string;
  is_featured?: boolean;
}

function SellerListingCard({ item }: { item: SellerListingItem }) {
  const router = useRouter();
  const condColor = CONDITION_COLORS[item.condition] ?? COLORS.textTertiary;
  const condLabel = CONDITION_LABELS[item.condition]?.en ?? item.condition.replace('_', ' ');

  return (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => router.push(`/listing/${item.id}` as any)}
      activeOpacity={0.88}
    >
      <View style={styles.listingImgWrap}>
        <Image
          source={{
            uri:
              item.primary_image_url ||
              'https://via.placeholder.com/300x300/e0e0e0/999?text=',
          }}
          style={styles.listingImg}
          resizeMode="cover"
        />
        {item.is_featured && (
          <View style={styles.boostedBadge}>
            <Text style={styles.boostedText}>⭐ Boosted</Text>
          </View>
        )}
      </View>
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={2}>
          {item.user_edited_title}
        </Text>
        <Text style={styles.listingPrice}>
          {Number(item.final_price).toLocaleString()} EGP
        </Text>
        <View style={[styles.condBadge, { backgroundColor: condColor }]}>
          <Text style={styles.condText}>{condLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────

export default function SellerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: me } = useAuthStore();
  const [messagePending, setMessagePending] = useState(false);

  // ── Load seller info ──────────────────────────
  const {
    data: seller,
    isLoading: sellerLoading,
    isError: sellerError,
    refetch: refetchSeller,
  } = useQuery({
    queryKey: ['seller-profile', id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}`);
      return data.user as {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        trust_score: number;
        total_reviews: number;
        is_phone_verified: boolean;
        is_id_verified: boolean;
        created_at: string;
      };
    },
    enabled: !!id,
  });

  // ── Load seller's listings ────────────────────
  const {
    data: listings,
    isLoading: listingsLoading,
    refetch: refetchListings,
    isRefetching,
  } = useQuery({
    queryKey: ['seller-listings', id],
    queryFn: () => listingService.getByUser(id),
    enabled: !!id,
  });

  // ── Load seller's reviews ─────────────────────
  const { data: reviews } = useQuery({
    queryKey: ['seller-reviews', id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}/reviews`);
      return (data.reviews ?? []) as Array<{
        id: string;
        rating: number;
        review_text?: string | null;
        reviewer_name?: string | null;
        created_at: string;
      }>;
    },
    enabled: !!id,
    // Non-critical — silently fail if endpoint doesn't exist
    retry: false,
  });

  // ── Message seller mutation ───────────────────
  const messageMutation = useMutation({
    mutationFn: async () => {
      // First check if a chat with this seller already exists
      const { data: chatsData } = await api.get('/chats');
      const existingChat = (chatsData.chats ?? []).find(
        (c: any) =>
          (c.buyer_id === me?.id && c.seller_id === id) ||
          (c.buyer_id === id && c.seller_id === me?.id),
      );
      if (existingChat) return existingChat;

      // Create a new chat (listing_id is null — direct seller contact)
      const { data } = await api.post('/chats', {
        listing_id: null,
        seller_id: id,
      });
      return data.chat;
    },
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      router.push(`/chat/${chat.id}` as any);
    },
    onError: () => Alert.alert('Error', 'Could not start conversation. Try again.'),
  });

  const handleMessage = () => {
    if (!me) {
      Alert.alert('Login required', 'Sign in to message this seller.');
      return;
    }
    messageMutation.mutate();
  };

  // ── Loading / error states ────────────────────
  const isLoading = sellerLoading || listingsLoading;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Seller', headerTintColor: COLORS.primary }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </>
    );
  }

  if (sellerError || !seller) {
    return (
      <>
        <Stack.Screen options={{ title: 'Seller', headerTintColor: COLORS.primary }} />
        <View style={styles.centered}>
          <Ionicons name="person-circle-outline" size={64} color={COLORS.border} />
          <Text style={styles.notFoundText}>Seller not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const isOwnProfile = me?.id === seller.id;
  const activeListings = (listings ?? []).filter(
    (l: any) => l.status === 'active' || !l.status,
  );
  const memberSince = formatMemberSince(seller.created_at);

  // ── Header component for FlatList ────────────
  const ListHeader = (
    <View>
      {/* ── Seller info card ─────────────────────── */}
      <View style={styles.profileCard}>
        {/* Avatar */}
        <View style={styles.avatarRow}>
          <Avatar name={seller.full_name} uri={seller.avatar_url} size={80} color={COLORS.primary} />
          <View style={styles.profileMeta}>
            <Text style={styles.sellerName}>{seller.full_name ?? 'Seller'}</Text>
            {memberSince ? (
              <Text style={styles.memberSince}>Member since {memberSince}</Text>
            ) : null}
            <View style={styles.trustRow}>
              <Stars rating={seller.trust_score ?? 0} size={15} />
              <Text style={styles.trustNum}>
                {Number(seller.trust_score ?? 0).toFixed(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Verification badges */}
        {(seller.is_phone_verified || seller.is_id_verified) && (
          <View style={styles.badgesRow}>
            {seller.is_phone_verified && (
              <View style={styles.badgeGreen}>
                <Ionicons name="call" size={11} color={COLORS.primary} />
                <Text style={styles.badgeGreenText}>Phone Verified</Text>
              </View>
            )}
            {seller.is_id_verified && (
              <View style={styles.badgeGold}>
                <Ionicons name="shield-checkmark" size={11} color="#B8860B" />
                <Text style={styles.badgeGoldText}>ID Verified</Text>
              </View>
            )}
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{seller.total_reviews ?? 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{activeListings.length}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
        </View>
      </View>

      {/* ── Message button ───────────────────────── */}
      {!isOwnProfile && (
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={handleMessage}
          disabled={messageMutation.isPending}
          activeOpacity={0.85}
        >
          {messageMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
              <Text style={styles.messageBtnText}>Message Seller</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* ── Reviews section ──────────────────────── */}
      {reviews && reviews.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
          {reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Stars rating={r.rating} size={13} />
                <Text style={styles.reviewDate}>{formatReviewDate(r.created_at)}</Text>
              </View>
              {r.review_text ? (
                <Text style={styles.reviewText}>{r.review_text}</Text>
              ) : null}
              {r.reviewer_name ? (
                <Text style={styles.reviewAuthor}>— {r.reviewer_name}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* ── Listings header ──────────────────────── */}
      <Text style={styles.listingsHeader}>
        Listings by {seller.full_name ?? 'this seller'}
      </Text>
    </View>
  );

  const EmptyListings = (
    <View style={styles.emptyWrap}>
      <Ionicons name="cube-outline" size={48} color={COLORS.border} />
      <Text style={styles.emptyText}>No active listings</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: seller.full_name ?? 'Seller',
          headerTintColor: COLORS.primary,
          headerBackTitle: 'Back',
        }}
      />

      <FlatList
        data={activeListings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetchSeller();
              refetchListings();
            }}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyListings}
        renderItem={({ item }) => <SellerListingCard item={item} />}
      />
    </>
  );
}

// ─────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── States ──────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  notFoundText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    fontSize: TYPOGRAPHY.fontSizeMD,
  },

  // ── Profile card ────────────────────────────
  profileCard: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    ...SHADOWS.sm,
    marginBottom: SPACING.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  profileMeta: {
    flex: 1,
    gap: SPACING.xs,
  },
  sellerName: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
  },
  memberSince: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textTertiary,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  trustNum: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary,
  },

  // ── Badges ──────────────────────────────────
  badgesRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
    marginBottom: SPACING.lg,
  },
  badgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeGreenText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  badgeGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8DC',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeGoldText: {
    fontSize: 11,
    color: '#B8860B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },

  // ── Stats ───────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },

  // ── Message button ───────────────────────────
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
  },
  messageBtnText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },

  // ── Reviews ─────────────────────────────────
  section: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  reviewCard: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 4,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewDate: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  reviewText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.text,
    lineHeight: TYPOGRAPHY.lineHeightSM,
    marginTop: 2,
  },
  reviewAuthor: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },

  // ── Listings header ──────────────────────────
  listingsHeader: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // ── FlatList layout ─────────────────────────
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },

  // ── Empty state ──────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingTop: SPACING.xxxl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textSecondary,
  },

  // ── Listing card (inline) ────────────────────
  listingCard: {
    width: CARD_W,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  listingImgWrap: {
    position: 'relative',
  },
  listingImg: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.borderLight,
  },
  boostedBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: '#F59E0B',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  boostedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  listingInfo: {
    padding: SPACING.sm,
    gap: 4,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
    lineHeight: TYPOGRAPHY.lineHeightSM,
  },
  listingPrice: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
  },
  condBadge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  condText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    textTransform: 'capitalize',
  },
});
