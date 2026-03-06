import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useFavoritesStore } from '../../store/listingStore';

const CONDITION_COLORS: Record<string, string> = {
  new: '#10B981', like_new: '#34D399', good: '#F59E0B', fair: '#F97316', poor: '#EF4444',
};
const CONDITION_LABELS: Record<string, string> = {
  new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor',
};

interface ListingCardProps {
  item: {
    id: string; user_edited_title: string; final_price: number;
    primary_image_url: string; condition: string;
    distance_km?: number; created_at?: string;
  };
  compact?: boolean;
}

export function ListingCard({ item, compact }: ListingCardProps) {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const fav = isFavorite(item.id);

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.compact]}
      onPress={() => router.push(`/listing/${item.id}`)}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${item.user_edited_title}, ${Number(item.final_price).toLocaleString()} EGP`}
    >
      <View style={compact ? styles.compactImgContainer : styles.imageContainer}>
        <Image
          source={{ uri: item.primary_image_url || 'https://placehold.co/400x400/F0F2F6/9EA5B0?text=Kaero' }}
          style={compact ? styles.compactImage : styles.image}
          resizeMode="cover"
        />
        {!compact && (
          <>
            <TouchableOpacity
              style={[styles.favBtn, fav && styles.favBtnActive]}
              onPress={(e) => { e.stopPropagation?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleFavorite(item.id); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={fav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Ionicons name={fav ? 'heart' : 'heart-outline'} size={15} color={fav ? COLORS.error : COLORS.iconDefault} />
            </TouchableOpacity>
            {item.condition && (
              <View style={[styles.conditionBadge, { backgroundColor: CONDITION_COLORS[item.condition] ?? '#9EA5B0' }]}>
                <Text style={styles.conditionText}>{CONDITION_LABELS[item.condition] ?? item.condition}</Text>
              </View>
            )}
          </>
        )}
      </View>
      <View style={[styles.info, compact && styles.compactInfo]}>
        <Text style={[styles.title, compact && styles.compactTitle]} numberOfLines={compact ? 1 : 2}>
          {item.user_edited_title}
        </Text>
        <Text style={styles.price}>
          {Number(item.final_price).toLocaleString()}
          <Text style={styles.currency}> EGP</Text>
        </Text>
        {item.distance_km !== undefined && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={11} color={COLORS.iconDefault} />
            <Text style={styles.meta}>
              {item.distance_km < 1 ? `${Math.round(item.distance_km * 1000)}m` : `${item.distance_km.toFixed(1)} km`}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.sm, width: '48%' },
  compact: { width: '100%', flexDirection: 'row', height: 96, borderRadius: RADIUS.md },
  imageContainer: { position: 'relative' },
  compactImgContainer: {},
  image: { width: '100%', height: 156, backgroundColor: COLORS.surfaceAlt },
  compactImage: { width: 96, height: 96, backgroundColor: COLORS.surfaceAlt },
  favBtn: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.full, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', ...SHADOWS.xs },
  favBtnActive: { backgroundColor: '#FFF0F0' },
  conditionBadge: { position: 'absolute', bottom: SPACING.sm, left: SPACING.sm, borderRadius: RADIUS.xs, paddingHorizontal: 6, paddingVertical: 2 },
  conditionText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  info: { padding: SPACING.sm, flex: 1 },
  compactInfo: { justifyContent: 'center', paddingHorizontal: SPACING.md },
  title: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text, marginBottom: 5, lineHeight: TYPOGRAPHY.lineHeightSM },
  compactTitle: { fontSize: TYPOGRAPHY.fontSizeMD, marginBottom: 4 },
  price: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.primary, letterSpacing: TYPOGRAPHY.letterSpacingTight },
  currency: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  meta: { fontSize: TYPOGRAPHY.fontSizeXS, color: COLORS.textTertiary },
});
