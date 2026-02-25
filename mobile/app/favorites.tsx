import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../constants/theme';
import { listingService } from '../services/listing.service';
import { ListingCard } from '../components/listing/ListingCard';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => listingService.getMyFavorites(),
  });

  const unfavMutation = useMutation({
    mutationFn: (id: string) => listingService.toggleFavorite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const listings = data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Listings</Text>
        <Text style={styles.headerCount}>{listings.length}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : listings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No saved listings</Text>
          <Text style={styles.emptyText}>Tap the heart icon on any listing to save it here.</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.browseBtnText}>Browse Listings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ListingCard item={item} />
              {/* Unfav button overlay */}
              <TouchableOpacity
                style={styles.unfavBtn}
                onPress={() => unfavMutation.mutate(item.id)}
              >
                <Ionicons name="heart" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', ...SHADOWS.sm,
  },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  headerCount: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, fontWeight: '600', width: 30, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: SPACING.md },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  emptyText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  browseBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  browseBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },
  list: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 40 },
  row: { justifyContent: 'space-between', gap: SPACING.md },
  cardWrap: { flex: 1, position: 'relative' },
  unfavBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.sm,
  },
});
