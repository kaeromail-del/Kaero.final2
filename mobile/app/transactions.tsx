import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../constants/theme';
import { transactionService } from '../services/transaction.service';
import { useAuthStore } from '../store/authStore';

// ─── Status config ────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Awaiting Payment', color: '#D97706', bg: '#FFF3CD', icon: 'time-outline' },
  paid:      { label: 'Paid',             color: '#1D4ED8', bg: '#EFF6FF', icon: 'card-outline' },
  held:      { label: 'In Escrow',        color: COLORS.primary, bg: COLORS.primaryLight, icon: 'shield-half' },
  released:  { label: 'Completed',        color: COLORS.success, bg: '#ECFDF5', icon: 'checkmark-circle' },
  refunded:  { label: 'Refunded',         color: '#7C3AED', bg: '#F5F3FF', icon: 'return-down-back' },
  disputed:  { label: 'Disputed',         color: COLORS.error, bg: '#FEF2F2', icon: 'warning' },
};

function getStatusConfig(paymentStatus: string, disputeStatus: string) {
  if (disputeStatus !== 'none') return STATUS_CONFIG['disputed'];
  return STATUS_CONFIG[paymentStatus] ?? { label: paymentStatus, color: COLORS.textSecondary, bg: '#F5F5F5', icon: 'ellipse-outline' };
}

// ─── Tab ─────────────────────────────────────────────────────

const TABS: { key: 'all' | 'buyer' | 'seller'; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'buyer',  label: 'Purchases' },
  { key: 'seller', label: 'Sales' },
];

// ─── Transaction card ─────────────────────────────────────────

function TransactionCard({ tx, userId, onPress }: { tx: any; userId: string; onPress: () => void }) {
  const isBuyer = tx.buyer_id === userId;
  const cfg = getStatusConfig(tx.payment_status, tx.dispute_status ?? 'none');

  return (
    <TouchableOpacity style={styles.txCard} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={{ uri: tx.listing_image || 'https://via.placeholder.com/64' }}
        style={styles.txImg}
      />
      <View style={styles.txInfo}>
        <View style={styles.txTopRow}>
          <Text style={styles.txTitle} numberOfLines={1}>{tx.listing_title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={styles.txPrice}>{Number(tx.agreed_price)?.toLocaleString()} EGP</Text>
        <View style={styles.txBottomRow}>
          <View style={styles.roleTag}>
            <Ionicons name={isBuyer ? 'bag-outline' : 'storefront-outline'} size={11} color={COLORS.textTertiary} />
            <Text style={styles.roleText}>{isBuyer ? 'Buyer' : 'Seller'}</Text>
          </View>
          <Text style={styles.txWith}>
            {isBuyer ? `from ${tx.seller_name}` : `to ${tx.buyer_name}`}
          </Text>
          <Text style={styles.txDate}>
            {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-EG', { month: 'short', day: 'numeric' }) : ''}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#CCC" />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function TransactionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'all' | 'buyer' | 'seller'>('all');

  const { data: txs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['transactions', tab],
    queryFn: () => transactionService.getMyTransactions(tab === 'all' ? undefined : tab),
    enabled: !!user,
  });

  const empty = !isLoading && (!txs || txs.length === 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Transactions</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={56} color="#CCC" />
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyDesc}>
            {tab === 'buyer' ? 'Your purchases will appear here.' : tab === 'seller' ? 'Your sales will appear here.' : 'Transactions appear here once you buy or sell.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={txs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionCard
              tx={item}
              userId={user?.id ?? ''}
              onPress={() => router.push(`/transaction/${item.id}` as any)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeightBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xl },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  emptyDesc: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  list: { padding: SPACING.md, gap: 0 },
  separator: { height: SPACING.xs },
  txCard: {
    backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, ...SHADOWS.sm,
  },
  txImg: { width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: '#F0F0F0' },
  txInfo: { flex: 1 },
  txTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  txTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text, flex: 1, marginRight: SPACING.xs },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: RADIUS.xs, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '700' },
  txPrice: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  txBottomRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  roleTag: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  roleText: { fontSize: 11, color: COLORS.textTertiary },
  txWith: { fontSize: 11, color: COLORS.textSecondary, flex: 1 },
  txDate: { fontSize: 11, color: COLORS.textTertiary },
});
