import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, CONDITION_COLORS } from '../../constants/theme';
import { listingService } from '../../services/listing.service';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/ui/Avatar';

const STATUS_TABS = ['active', 'reserved', 'sold'] as const;

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const { data: listings, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-listings', user?.id],
    queryFn: () => user ? listingService.getByUser(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => listingService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      Alert.alert('Deleted', 'Listing removed');
    },
  });

  const allListings = listings ?? [];
  const filtered = allListings.filter((l: any) => l.status === statusFilter);

  const stats = {
    active: allListings.filter((l: any) => l.status === 'active').length,
    sold: allListings.filter((l: any) => l.status === 'sold').length,
    views: allListings.reduce((s: number, l: any) => s + (l.view_count || 0), 0),
    offers: allListings.reduce((s: number, l: any) => s + (l.offer_count || 0), 0),
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Avatar name={user?.full_name} uri={user?.avatar_url} size={48} />
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{user?.full_name || 'My Store'}</Text>
            <View style={styles.verifiedRow}>
              {user?.is_phone_verified && <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ Verified</Text></View>}
              <Text style={styles.trust}>⭐ {(user?.trust_score ?? 5).toFixed(1)} ({user?.total_reviews ?? 0})</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Active', value: stats.active, icon: 'storefront-outline' },
            { label: 'Sold', value: stats.sold, icon: 'checkmark-circle-outline' },
            { label: 'Views', value: stats.views, icon: 'eye-outline' },
            { label: 'Offers', value: stats.offers, icon: 'pricetag-outline' },
          ].map(s => (
            <View key={s.label} style={styles.stat}>
              <Ionicons name={s.icon as any} size={18} color={COLORS.primary} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Status tabs */}
      <View style={styles.tabsRow}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, statusFilter === tab && styles.tabActive]}
            onPress={() => setStatusFilter(tab)}
          >
            <Text style={[styles.tabText, statusFilter === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'active' && stats.active > 0 ? ` (${stats.active})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              style={styles.listingCard}
              onPress={() => router.push(`/listing/${item.id}`)}
              activeOpacity={0.85}
            >
              <View style={[styles.conditionStripe, { backgroundColor: CONDITION_COLORS[item.condition] || '#999' }]} />
              <View style={styles.cardContent}>
                <Text style={styles.listingTitle} numberOfLines={2}>{item.user_edited_title}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.listingPrice}>{item.final_price?.toLocaleString()} EGP</Text>
                  <View style={styles.cardStats}>
                    <Text style={styles.metaChip}><Ionicons name="eye-outline" size={12} /> {item.view_count || 0}</Text>
                    <Text style={styles.metaChip}><Ionicons name="pricetag-outline" size={12} /> {item.offer_count || 0}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardActions}>
                {item.offer_count > 0 && (
                  <TouchableOpacity
                    style={styles.offersBtn}
                    onPress={() => router.push(`/listing/offers/${item.id}` as any)}
                  >
                    <Text style={styles.offersBtnText}>{item.offer_count} Offer{item.offer_count > 1 ? 's' : ''}</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'active' && (
                  <TouchableOpacity onPress={() => router.push(`/listing/edit/${item.id}`)}>
                    <Ionicons name="pencil-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => Alert.alert('Delete Listing', 'Remove this listing?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
                  ])}
                >
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{statusFilter === 'sold' ? '🎉' : '📦'}</Text>
              <Text style={styles.emptyTitle}>
                {statusFilter === 'active' ? 'No active listings' :
                 statusFilter === 'sold' ? 'No sales yet' : 'Nothing reserved'}
              </Text>
              {statusFilter === 'active' && (
                <TouchableOpacity style={styles.sellBtn} onPress={() => router.push('/(tabs)/sell')}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.sellBtnText}>List an Item</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#fff', padding: SPACING.lg, ...SHADOWS.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  headerInfo: { flex: 1 },
  name: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  verifiedBadge: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  trust: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },
  tabsRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, fontWeight: TYPOGRAPHY.fontWeightMedium },
  tabTextActive: { color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeightBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 100 },
  listingCard: { backgroundColor: '#fff', borderRadius: RADIUS.md, flexDirection: 'row', overflow: 'hidden', ...SHADOWS.sm },
  conditionStripe: { width: 5 },
  cardContent: { flex: 1, padding: SPACING.md },
  listingTitle: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text, marginBottom: SPACING.xs },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listingPrice: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.primary },
  cardStats: { flexDirection: 'row', gap: SPACING.sm },
  metaChip: { fontSize: 12, color: COLORS.textTertiary },
  cardActions: { padding: SPACING.sm, gap: SPACING.sm, alignItems: 'flex-end', justifyContent: 'center' },
  offersBtn: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 },
  offersBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.textSecondary },
  sellBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, marginTop: SPACING.md },
  sellBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },
});
