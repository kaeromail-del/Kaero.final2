import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { listingService } from '../../services/listing.service';
import { categoryService } from '../../services/category.service';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import { ListingCard } from '../../components/listing/ListingCard';
import api from '../../services/api';
import { aiService } from '../../services/ai.service';

const SORT_OPTIONS = [
  { value: 'distance', label: 'Nearest' },
  { value: 'newest',   label: 'Newest' },
  { value: 'price',    label: 'Price' },
  { value: 'for_you',  label: 'For You' },
] as const;

const CAIRO = { lat: 30.0444, lng: 31.2357 };

export default function MarketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { coords, address, requestLocation } = useLocationStore();

  const effectiveCoords = coords ?? CAIRO;

  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [sort, setSort]                = useState<'distance' | 'newest' | 'price' | 'for_you'>('newest');
  const [viewMode, setViewMode]        = useState<'list' | 'map'>('list');

  React.useEffect(() => { if (!coords) requestLocation(); }, []);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
    staleTime: 1000 * 60 * 10,
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['listings', 'nearby', selectedCat, sort, coords],
    queryFn: ({ pageParam }) => listingService.getNearby({
      lat: effectiveCoords.lat,
      lng: effectiveCoords.lng,
      radius: 50000,
      category_id: selectedCat ?? undefined,
      sort: sort === 'for_you' ? 'newest' : sort,
      cursor: pageParam as string | undefined,
      limit: 20,
    }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    initialPageParam: undefined,
    enabled: sort !== 'for_you',
  });

  const {
    data: personalizedData,
    isLoading: personalizedLoading,
    refetch: refetchPersonalized,
  } = useQuery({
    queryKey: ['listings', 'personalized', coords],
    queryFn: () => api.get('/listings/personalized', {
      params: { lat: effectiveCoords.lat, lng: effectiveCoords.lng, limit: 30 },
    }).then(r => r.data.listings),
    enabled: sort === 'for_you',
    staleTime: 1000 * 60 * 5,
  });

  const listings = sort === 'for_you'
    ? (personalizedData ?? [])
    : (data?.pages.flatMap(p => p.listings) ?? []);

  const showLoading = sort === 'for_you' ? personalizedLoading : isLoading;

  const handleRefresh = useCallback(() => {
    if (sort === 'for_you') {
      refetchPersonalized();
    } else {
      refetch();
    }
  }, [sort, refetch, refetchPersonalized]);

  const isRefreshingActive = sort === 'for_you' ? false : isRefetching;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋</Text>
            {address && (
              <TouchableOpacity style={styles.locationRow} onPress={requestLocation}>
                <Ionicons name="location" size={12} color={COLORS.primary} />
                <Text style={styles.locationText} numberOfLines={1}>{address}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/search')} style={styles.headerIconBtn}>
              <Ionicons name="mic" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerIconBtn}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/search')} activeOpacity={0.8}>
          <Ionicons name="search" size={18} color="#AAA" />
          <Text style={styles.searchPlaceholder}>Search phones, laptops, cars...</Text>
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catsContainer}
        style={styles.catsScroll}
      >
        <TouchableOpacity
          style={[styles.catChip, !selectedCat && styles.catChipActive]}
          onPress={() => setSelectedCat(null)}
        >
          <Text style={[styles.catText, !selectedCat && styles.catTextActive]}>All</Text>
        </TouchableOpacity>
        {categories?.map((cat: any) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, selectedCat === cat.id && styles.catChipActive]}
            onPress={() => setSelectedCat(cat.id === selectedCat ? null : cat.id)}
          >
            <Text style={styles.catEmoji}>{getCatEmoji(cat.name_en)}</Text>
            <Text style={[styles.catText, selectedCat === cat.id && styles.catTextActive]}>{cat.name_en}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort + View Toggle */}
      <View style={styles.sortRow}>
        <Text style={styles.resultsCount}>{listings.length} listings</Text>
        <View style={styles.sortBtns}>
          {SORT_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.sortBtn, sort === o.value && styles.sortBtnActive]}
              onPress={() => setSort(o.value)}
            >
              <Text style={[styles.sortText, sort === o.value && styles.sortTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* List / Map toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="grid-outline" size={16} color={viewMode === 'list' ? COLORS.primary : '#999'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === 'map' && styles.viewBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map-outline" size={16} color={viewMode === 'map' ? COLORS.primary : '#999'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content: list OR map */}
      {showLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding listings near you...</Text>
        </View>
      ) : viewMode === 'map' ? (
        // ── Map view ──────────────────────────────────────────────
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: effectiveCoords.lat,
            longitude: effectiveCoords.lng,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          showsUserLocation
          showsMyLocationButton
        >
          {listings.map((item: any) => {
            const lat = item.lat ?? item.location_lat;
            const lng = item.lng ?? item.location_lng;
            if (!lat || !lng) return null;
            return (
              <Marker
                key={item.id}
                coordinate={{ latitude: Number(lat), longitude: Number(lng) }}
                title={item.user_edited_title}
                description={`EGP ${Number(item.final_price).toLocaleString()}`}
              >
                {/* Custom price bubble */}
                <View style={styles.priceBubble}>
                  <Text style={styles.priceBubbleText}>
                    {Number(item.final_price) >= 1000
                      ? `${Math.round(Number(item.final_price) / 1000)}k`
                      : Number(item.final_price)}
                  </Text>
                </View>
                <Callout onPress={() => router.push(`/listing/${item.id}`)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>{item.user_edited_title}</Text>
                    <Text style={styles.calloutPrice}>EGP {Number(item.final_price).toLocaleString()}</Text>
                    <Text style={styles.calloutTap}>Tap to view →</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      ) : (
        // ── List view ─────────────────────────────────────────────
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => {
                aiService.trackView(item.id);
                router.push(`/listing/${item.id}`);
              }}
            >
              <View pointerEvents="none">
                <ListingCard item={item} />
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingActive}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={() => sort !== 'for_you' && hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            sort === 'for_you' ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>✨</Text>
                <Text style={styles.emptyTitle}>Personalizing your feed</Text>
                <Text style={styles.emptyText}>Browse a few listings and we'll tailor your feed to your interests.</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏪</Text>
                <Text style={styles.emptyTitle}>No listings nearby</Text>
                <Text style={styles.emptyText}>Be the first to sell in your area!</Text>
                <TouchableOpacity style={styles.sellBtn} onPress={() => router.push('/(tabs)/sell')}>
                  <Text style={styles.sellBtnText}>Sell Something</Text>
                </TouchableOpacity>
              </View>
            )
          }
          ListFooterComponent={
            sort !== 'for_you' && isFetchingNextPage
              ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} />
              : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function getCatEmoji(name: string): string {
  const map: Record<string, string> = {
    Phones: '📱', 'Mobile Phones': '📱', Electronics: '💻', Laptops: '💻', Audio: '🎧',
    Gaming: '🎮', Cameras: '📸', Tablets: '📱', Drones: '🚁',
    Furniture: '🛋️', 'Home & Garden': '🏡', Cars: '🚗', Vehicles: '🚗',
    Fashion: '👗', Sports: '⚽', Books: '📚', Home: '🏠', Other: '📦',
  };
  return map[name] ?? '📦';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#fff', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, ...SHADOWS.sm },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  greeting: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { fontSize: 12, color: COLORS.textSecondary, maxWidth: 200 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#F5F5F5', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, height: 44,
  },
  searchPlaceholder: { color: '#AAA', fontSize: TYPOGRAPHY.fontSizeMD, flex: 1 },
  catsScroll: { flexGrow: 0 },
  catsContainer: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#DDD',
    backgroundColor: '#fff',
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catEmoji: { fontSize: 14 },
  catText: { fontSize: TYPOGRAPHY.fontSizeSM, color: '#555', fontWeight: TYPOGRAPHY.fontWeightMedium },
  catTextActive: { color: '#fff' },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs },
  resultsCount: { fontSize: 12, color: COLORS.textSecondary },
  sortBtns: { flexDirection: 'row', gap: SPACING.xs },
  sortBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  sortBtnActive: { backgroundColor: COLORS.primaryLight },
  sortText: { fontSize: 12, color: '#999' },
  sortTextActive: { color: COLORS.primary, fontWeight: '600' },
  viewToggle: { flexDirection: 'row', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: RADIUS.sm, overflow: 'hidden' },
  viewBtn: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  viewBtnActive: { backgroundColor: COLORS.primaryLight },
  map: { flex: 1 },
  priceBubble: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 2, borderColor: '#fff',
  },
  priceBubbleText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  callout: { width: 180, padding: SPACING.sm },
  calloutTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.text },
  calloutPrice: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  calloutTap: { fontSize: 11, color: COLORS.textTertiary, marginTop: 4 },
  listContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 100 },
  row: { justifyContent: 'space-between', gap: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  emptyText: { color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.xl },
  sellBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  sellBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },
});
