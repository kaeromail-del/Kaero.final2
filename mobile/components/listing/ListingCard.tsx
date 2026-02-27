import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useFavoritesStore } from '../../store/listingStore';

const CONDITION_COLORS: Record<string, string> = {
  new: '#43A047', like_new: '#7CB342', good: '#FB8C00', fair: '#F4511E', poor: '#E53935'
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
      activeOpacity={0.9}
    >
      <View style={compact ? styles.compactImgContainer : styles.imageContainer}>
        <Image
          source={{ uri: item.primary_image_url || 'https://via.placeholder.com/300x300/e0e0e0/999?text=' }}
          style={compact ? styles.compactImage : styles.image}
          resizeMode="cover"
        />
        {!compact && (
          <>
            <TouchableOpacity
              style={styles.favBtn}
              onPress={(e) => { e.stopPropagation?.(); toggleFavorite(item.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={fav ? 'heart' : 'heart-outline'} size={18} color={fav ? COLORS.error : '#fff'} />
            </TouchableOpacity>
            <View style={[styles.conditionBadge, { backgroundColor: CONDITION_COLORS[item.condition] || '#999' }]}>
              <Text style={styles.conditionText}>{item.condition?.replace('_', ' ')}</Text>
            </View>
          </>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.user_edited_title}</Text>
        <Text style={styles.price}>{item.final_price?.toLocaleString()} EGP</Text>
        {item.distance_km !== undefined && (
          <Text style={styles.meta}>
            <Ionicons name="location-outline" size={11} color={COLORS.iconDefault} />
            {' '}{item.distance_km < 1 ? `${Math.round(item.distance_km * 1000)}m` : `${item.distance_km.toFixed(1)} km`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.sm, width: '48%' },
  compact: { width: '100%', flexDirection: 'row', height: 100 },
  imageContainer: { position: 'relative' },
  compactImgContainer: {},
  image: { width: '100%', height: 160, backgroundColor: COLORS.borderLight },
  compactImage: { width: 100, height: 100 },
  favBtn: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: RADIUS.full, padding: 5 },
  conditionBadge: { position: 'absolute', bottom: SPACING.sm, left: SPACING.sm, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  conditionText: { color: '#fff', fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  info: { padding: SPACING.sm, flex: 1 },
  title: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text, marginBottom: 4, lineHeight: 18 },
  price: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.primary },
  meta: { fontSize: 11, color: COLORS.textTertiary, marginTop: 3 },
});
