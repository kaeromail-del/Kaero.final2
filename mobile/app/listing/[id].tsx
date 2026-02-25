import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, Alert, Share, FlatList,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, CONDITION_LABELS } from '../../constants/theme';
import { listingService } from '../../services/listing.service';
import { referralService } from '../../services/referral.service';
import { offerService } from '../../services/offer.service';
import { chatService } from '../../services/chat.service';
import { useAuthStore } from '../../store/authStore';
import { useFavoritesStore } from '../../store/listingStore';
import { useLocationStore } from '../../store/locationStore';
import { Avatar } from '../../components/ui/Avatar';
import { Stars } from '../../components/ui/Stars';

const { width: SCREEN_W } = Dimensions.get('window');

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'Just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-EG', { day: 'numeric', month: 'short' });
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { coords: myCoords } = useLocationStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const queryClient = useQueryClient();
  const [imgIdx, setImgIdx] = useState(0);
  const [favLoading, setFavLoading] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingService.getById(id),
    enabled: !!id,
  });

  const { data: similar } = useQuery({
    queryKey: ['similar', id],
    queryFn: () => listingService.getSimilar(id),
    enabled: !!id,
  });

  const chatMutation = useMutation({
    mutationFn: () => chatService.startChat(id),
    onSuccess: (chat) => router.push(`/chat/${chat.id}`),
    onError: () => Alert.alert('Error', 'Failed to start chat'),
  });

  const handleFavorite = async () => {
    if (!user) { Alert.alert('Login required', 'Sign in to save listings'); return; }
    setFavLoading(true);
    try {
      const result = await listingService.toggleFavorite(id);
      toggleFavorite(id); // sync local store
      queryClient.invalidateQueries({ queryKey: ['listing', id] });
    } catch { Alert.alert('Error', 'Failed to update favorites'); }
    finally { setFavLoading(false); }
  };

  const handleReport = () => {
    Alert.alert('Report Listing', 'Why are you reporting this?', [
      { text: 'Fake / Scam', onPress: () => listingService.report(id, 'fake').then(() => Alert.alert('Reported', 'Thanks for keeping Kaero safe.')) },
      { text: 'Wrong Price', onPress: () => listingService.report(id, 'overpriced').then(() => Alert.alert('Reported', 'Thanks for keeping Kaero safe.')) },
      { text: 'Spam', onPress: () => listingService.report(id, 'spam').then(() => Alert.alert('Reported', 'Thanks for keeping Kaero safe.')) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: COLORS.textSecondary }}>Listing not found</Text>
      </View>
    );
  }

  const images = [listing.primary_image_url, ...(listing.additional_images || [])].filter(Boolean);
  const isOwner = user?.id === listing.seller_id;
  const fav = isFavorite(id);

  const handleShare = async () => {
    await Share.share({
      title: listing.user_edited_title,
      message: `Check out "${listing.user_edited_title}" on Kaero for ${Number(listing.final_price).toLocaleString()} EGP! https://kaero.app/listing/${id}`,
    });
  };

  const handleBoost = async (tier: 'basic' | 'standard' | 'premium') => {
    try {
      const res = await referralService.boostListing(id, tier);
      queryClient.invalidateQueries({ queryKey: ['listing', id] });
      Alert.alert('Listing Boosted!', res.message);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Boost failed');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Image carousel */}
        <View style={styles.imageSection}>
          <FlatList
            data={images.length > 0 ? images : ['placeholder']}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item !== 'placeholder' ? item : 'https://via.placeholder.com/400x400/e0e0e0/999?text=No+Image' }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            )}
            keyExtractor={(_, i) => String(i)}
          />
          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
              ))}
            </View>
          )}
          {/* Top controls */}
          <View style={[styles.imgTopControls, { top: insets.top + 8 }]}>
            <TouchableOpacity style={styles.imgBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.imgTopRight}>
              <TouchableOpacity style={styles.imgBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.imgBtn} onPress={handleFavorite} disabled={favLoading}>
                {favLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name={fav ? 'heart' : 'heart-outline'} size={22} color={fav ? COLORS.error : '#fff'} />
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.imgBtn} onPress={handleReport}>
                <Ionicons name="flag-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Condition badge */}
          <View style={[styles.condBadge, { backgroundColor: listing.condition === 'new' ? COLORS.success : COLORS.warning }]}>
            <Text style={styles.condText}>{CONDITION_LABELS[listing.condition]?.en ?? listing.condition}</Text>
          </View>
          {/* Boosted badge */}
          {listing.is_featured && (
            <View style={styles.boostedBadge}>
              <Ionicons name="rocket" size={11} color="#fff" />
              <Text style={styles.boostedText}>Boosted</Text>
            </View>
          )}
        </View>

        {/* Title & price */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{listing.user_edited_title}</Text>
            <Text style={styles.price}>{listing.final_price?.toLocaleString()} EGP</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}><Ionicons name="time-outline" size={12} /> {timeAgo(listing.created_at)}</Text>
            <Text style={styles.meta}><Ionicons name="eye-outline" size={12} /> {listing.view_count} views</Text>
            <Text style={styles.meta}><Ionicons name="pricetag-outline" size={12} /> {listing.offer_count} offers</Text>
          </View>
        </View>

        {/* Description */}
        {listing.user_edited_description && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{listing.user_edited_description}</Text>
          </View>
        )}

        {/* AI badge */}
        {listing.is_ai_generated && (
          <View style={styles.aiCard}>
            <Ionicons name="sparkles" size={14} color={COLORS.primary} />
            <Text style={styles.aiText}>AI-verified listing • Auto-generated description</Text>
          </View>
        )}

        {/* Location mini-map */}
        {(listing.lat || listing.location_lat) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Location</Text>
            {(() => {
              const lat = Number(listing.lat ?? listing.location_lat);
              const lng = Number(listing.lng ?? listing.location_lng);
              // Haversine distance from user
              let distText = '';
              if (myCoords) {
                const R = 6371;
                const dLat = (lat - myCoords.lat) * Math.PI / 180;
                const dLng = (lng - myCoords.lng) * Math.PI / 180;
                const a = Math.sin(dLat/2)**2 + Math.cos(myCoords.lat * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2)**2;
                const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                distText = km < 1 ? `${Math.round(km * 1000)}m away` : `${km.toFixed(1)} km away`;
              }
              return (
                <>
                  {distText ? (
                    <View style={styles.distRow}>
                      <Ionicons name="location" size={14} color={COLORS.primary} />
                      <Text style={styles.distText}>{distText}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => Alert.alert('Exact location', 'Exact location is shared after offer is accepted.')}
                  >
                    <MapView
                      style={styles.miniMap}
                      initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                      pointerEvents="none"
                    >
                      <Circle
                        center={{ latitude: lat, longitude: lng }}
                        radius={500}
                        fillColor="rgba(0,166,81,0.15)"
                        strokeColor="rgba(0,166,81,0.4)"
                        strokeWidth={1}
                      />
                    </MapView>
                    <View style={styles.mapOverlay}>
                      <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
                      <Text style={styles.mapOverlayText}>Approximate area shown for privacy</Text>
                    </View>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        )}

        {/* Seller info */}
        {listing.seller && (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/seller/${listing.seller_id}` as any)}
          >
            <Text style={styles.sectionTitle}>Seller</Text>
            <View style={styles.sellerRow}>
              <Avatar name={listing.seller.full_name} uri={listing.seller.avatar_url} size={48} />
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{listing.seller.full_name}</Text>
                <Stars rating={listing.seller.trust_score ?? 5} size={14} showNumber count={listing.seller.total_reviews} />
                {listing.seller.is_phone_verified && (
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </View>
          </TouchableOpacity>
        )}

        {/* Similar listings */}
        {similar && similar.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Similar Listings</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
              {similar.map((item: any) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.similarCard}
                  onPress={() => router.push(`/listing/${item.id}` as any)}
                >
                  <Image source={{ uri: item.primary_image_url || 'https://via.placeholder.com/120' }} style={styles.similarImg} />
                  <Text style={styles.similarTitle} numberOfLines={2}>{item.user_edited_title}</Text>
                  <Text style={styles.similarPrice}>{item.final_price?.toLocaleString()} EGP</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Action buttons */}
      {!isOwner && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + SPACING.md }]}>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => chatMutation.mutate()}
            disabled={chatMutation.isPending}
          >
            {chatMutation.isPending
              ? <ActivityIndicator color={COLORS.primary} size="small" />
              : <><Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} /><Text style={styles.chatBtnText}>Chat</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.offerBtn}
            onPress={() => router.push({ pathname: '/offer/new', params: { listingId: id } })}
          >
            <Ionicons name="pricetag" size={20} color="#fff" />
            <Text style={styles.offerBtnText}>Make Offer</Text>
          </TouchableOpacity>
        </View>
      )}
      {isOwner && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + SPACING.md }]}>
          <TouchableOpacity
            style={[styles.chatBtn]}
            onPress={() => router.push(`/listing/offers/${id}` as any)}
          >
            <Ionicons name="pricetag-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.chatBtnText]}>Offers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chatBtn]}
            onPress={() => {
              Alert.alert('Boost Listing', 'Choose a boost tier:', [
                { text: 'Basic — 15 EGP / 1 day',     onPress: () => handleBoost('basic') },
                { text: 'Standard — 49 EGP / 7 days',  onPress: () => handleBoost('standard') },
                { text: 'Premium — 149 EGP / 30 days', onPress: () => handleBoost('premium') },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          >
            <Ionicons name="rocket-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.chatBtnText]}>{listing.is_featured ? 'Boosted ✓' : 'Boost'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.offerBtn, { flex: 1.5 }]}
            onPress={() => router.push(`/listing/edit/${id}` as any)}
          >
            <Ionicons name="pencil" size={18} color="#fff" />
            <Text style={styles.offerBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  imageSection: { position: 'relative', backgroundColor: '#000' },
  mainImage: { width: SCREEN_W, height: SCREEN_W * 0.85 },
  dots: { position: 'absolute', bottom: SPACING.md, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 16 },
  imgTopControls: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md },
  imgBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  imgTopRight: { flexDirection: 'row', gap: SPACING.xs },
  condBadge: { position: 'absolute', bottom: SPACING.md, left: SPACING.md, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  condText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  boostedBadge: { position: 'absolute', bottom: SPACING.md, right: SPACING.md, backgroundColor: '#F59E0B', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  boostedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#fff', padding: SPACING.lg, marginTop: SPACING.sm },
  titleRow: { marginBottom: SPACING.sm },
  title: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text, marginBottom: SPACING.xs, lineHeight: 26 },
  price: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  metaRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: COLORS.textTertiary },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  description: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text, lineHeight: 22 },
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.primaryLight, margin: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.sm },
  aiText: { color: COLORS.primary, fontSize: TYPOGRAPHY.fontSizeSM },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  sellerInfo: { flex: 1, gap: 3 },
  sellerName: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.text },
  verifiedText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  similarCard: { width: 130, backgroundColor: '#fff', borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' },
  similarImg: { width: 130, height: 100, resizeMode: 'cover' },
  similarTitle: { fontSize: 12, color: COLORS.text, padding: 6, paddingBottom: 2, fontWeight: '500' },
  similarPrice: { fontSize: 13, color: COLORS.primary, fontWeight: '700', paddingHorizontal: 6, paddingBottom: 6 },
  actions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    ...SHADOWS.md,
  },
  chatBtn: {
    flex: 0.4, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.md,
  },
  chatBtnText: { color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },
  offerBtn: {
    flex: 1, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
  },
  offerBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
  distText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.primary, fontWeight: '600' },
  miniMap: { width: '100%', height: 160, borderRadius: RADIUS.md, overflow: 'hidden' },
  mapOverlay: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: SPACING.xs, paddingHorizontal: 2,
  },
  mapOverlayText: { fontSize: 11, color: COLORS.textTertiary },
});
