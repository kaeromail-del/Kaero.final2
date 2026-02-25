import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../constants/theme';
import { offerService } from '../services/offer.service';

const STATUS_TABS = ['pending', 'countered', 'accepted', 'rejected'] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_CONFIG: Record<StatusTab, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#F59E0B', bg: '#FFFBEB' },
  countered: { label: 'Countered', color: COLORS.primary, bg: COLORS.primaryLight },
  accepted:  { label: 'Accepted',  color: '#10B981', bg: '#ECFDF5' },
  rejected:  { label: 'Declined',  color: '#EF4444', bg: '#FEF2F2' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'Just now';
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MyOffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<StatusTab>('pending');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-offers'],
    queryFn: () => offerService.getMyOffers(),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => offerService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-offers'] });
      Alert.alert('Cancelled', 'Your offer has been cancelled.');
    },
    onError: () => Alert.alert('Error', 'Failed to cancel offer'),
  });

  const acceptCounterMutation = useMutation({
    mutationFn: (id: string) => offerService.acceptCounter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-offers'] });
      Alert.alert('Accepted!', 'Counter offer accepted. Proceed to payment.');
    },
    onError: () => Alert.alert('Error', 'Failed to accept counter offer'),
  });

  const allOffers: any[] = data ?? [];
  const filtered = allOffers.filter(o => o.status === tab);

  const counts: Record<string, number> = {};
  for (const o of allOffers) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Offers</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Status tabs */}
      <View style={styles.tabs}>
        {STATUS_TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {STATUS_CONFIG[t].label}
              {counts[t] ? ` (${counts[t]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => router.push(`/listing/${item.listing_id}` as any)}
            >
              {/* Listing image */}
              <Image
                source={{ uri: item.listing_image || 'https://via.placeholder.com/80' }}
                style={styles.img}
              />
              <View style={styles.cardBody}>
                <Text style={styles.listingTitle} numberOfLines={2}>{item.listing_title}</Text>

                <View style={styles.priceRow}>
                  <Text style={styles.askingLabel}>Asking</Text>
                  <Text style={styles.askingPrice}>{Number(item.listing_price)?.toLocaleString()} EGP</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.offerLabel}>Your offer</Text>
                  <Text style={styles.offerPrice}>{Number(item.offered_price)?.toLocaleString()} EGP</Text>
                </View>

                {item.status === 'countered' && item.counter_price && (
                  <View style={styles.counterBox}>
                    <Ionicons name="swap-horizontal" size={13} color={COLORS.primary} />
                    <Text style={styles.counterText}>
                      Counter: {Number(item.counter_price)?.toLocaleString()} EGP
                    </Text>
                  </View>
                )}

                <View style={styles.footer}>
                  <View style={[styles.badge, { backgroundColor: STATUS_CONFIG[item.status as StatusTab]?.bg ?? '#F5F5F5' }]}>
                    <Text style={[styles.badgeText, { color: STATUS_CONFIG[item.status as StatusTab]?.color ?? '#999' }]}>
                      {STATUS_CONFIG[item.status as StatusTab]?.label ?? item.status}
                    </Text>
                  </View>
                  <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.actions}>
                {item.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => Alert.alert('Cancel Offer', 'Withdraw this offer?', [
                      { text: 'No', style: 'cancel' },
                      { text: 'Yes', style: 'destructive', onPress: () => cancelMutation.mutate(item.id) },
                    ])}
                  >
                    <Ionicons name="close" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                )}
                {item.status === 'countered' && (
                  <>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => Alert.alert(
                        'Accept Counter',
                        `Accept ${Number(item.counter_price)?.toLocaleString()} EGP?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Accept', onPress: () => acceptCounterMutation.mutate(item.id) },
                        ]
                      )}
                    >
                      {acceptCounterMutation.isPending
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="checkmark" size={16} color="#fff" />
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => cancelMutation.mutate(item.id)}
                    >
                      <Ionicons name="close" size={16} color={COLORS.error} />
                    </TouchableOpacity>
                  </>
                )}
                {item.status === 'accepted' && (
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => router.push(`/payment/${item.transaction_id}` as any)}
                  >
                    <Text style={styles.payBtnText}>Pay</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{tab === 'accepted' ? '🎉' : tab === 'rejected' ? '😕' : '📋'}</Text>
              <Text style={styles.emptyTitle}>No {STATUS_CONFIG[tab].label.toLowerCase()} offers</Text>
              {tab === 'pending' && (
                <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace('/(tabs)')}>
                  <Text style={styles.browseBtnText}>Browse Listings</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', ...SHADOWS.sm,
  },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tab: { flex: 1, paddingVertical: SPACING.sm + 2, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeightBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 60 },
  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.md, flexDirection: 'row',
    overflow: 'hidden', ...SHADOWS.sm,
  },
  img: { width: 90, height: 90, backgroundColor: '#F0F0F0' },
  cardBody: { flex: 1, padding: SPACING.sm, gap: 4 },
  listingTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text, lineHeight: 18 },
  priceRow: { flexDirection: 'row', gap: SPACING.xs, alignItems: 'center' },
  askingLabel: { fontSize: 11, color: COLORS.textTertiary },
  askingPrice: { fontSize: 12, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  offerLabel: { fontSize: 11, color: COLORS.textTertiary },
  offerPrice: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.primary },
  counterBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  counterText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  timeAgo: { fontSize: 11, color: COLORS.textTertiary },
  actions: { padding: SPACING.sm, gap: SPACING.xs, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
    borderColor: COLORS.error, alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center',
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
  },
  payBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.textSecondary },
  browseBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.md },
  browseBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },
});
