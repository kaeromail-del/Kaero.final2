import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { transactionService } from '../../services/transaction.service';
import { useAuthStore } from '../../store/authStore';

// ─── Helpers ──────────────────────────────────────────────

interface Step {
  key: string;
  label: string;
  sub: string;
  icon: string;
  done: boolean;
  active: boolean;
}

function buildSteps(tx: any, isBuyer: boolean): Step[] {
  const s = tx.payment_status;
  const d = tx.dispute_status;

  return [
    {
      key: 'offer',
      label: 'Offer Accepted',
      sub: 'Seller accepted your offer',
      icon: 'checkmark-circle',
      done: true,
      active: false,
    },
    {
      key: 'payment',
      label: isBuyer ? 'Payment Initiated' : 'Awaiting Payment',
      sub: isBuyer
        ? s === 'pending' ? 'Choose a payment method below' : `Paid via ${tx.payment_method ?? '—'}`
        : s === 'pending' ? 'Buyer has not paid yet' : `Paid via ${tx.payment_method ?? '—'}`,
      icon: 'card',
      done: s !== 'pending',
      active: s === 'pending',
    },
    {
      key: 'escrow',
      label: 'In Escrow',
      sub: s === 'held'
        ? d !== 'none' ? 'Dispute opened' : 'Waiting for buyer to confirm receipt'
        : s === 'pending' ? 'Pending payment' : 'Completed',
      icon: 'shield-half',
      done: s !== 'pending' && s !== 'held',
      active: s === 'held' && d === 'none',
    },
    {
      key: 'done',
      label: d !== 'none' ? 'Dispute' : s === 'refunded' ? 'Refunded' : 'Completed',
      sub: d !== 'none'
        ? { none: '', opened: 'Under Kaero review', under_review: 'Under Kaero review', resolved_buyer: 'Resolved — buyer refunded', resolved_seller: 'Resolved — seller paid' }[d] ?? d
        : s === 'released' ? 'Payment released to seller' : s === 'refunded' ? 'Payment returned to buyer' : 'Awaiting completion',
      icon: d !== 'none' ? 'warning' : s === 'refunded' ? 'return-down-back' : 'checkmark-done-circle',
      done: ['released', 'refunded', 'resolved_buyer', 'resolved_seller'].includes(s) || d.startsWith('resolved'),
      active: d === 'opened' || d === 'under_review',
    },
  ];
}

function msToCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

// ─── Component ────────────────────────────────────────────

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: tx, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionService.getById(id),
    refetchInterval: 30000,
    enabled: !!id,
  });

  const confirmMutation = useMutation({
    mutationFn: () => transactionService.confirmReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      Alert.alert('Done!', 'Payment released. Leave a review?', [
        { text: 'Leave Review', onPress: () => router.push(`/review/${id}` as any) },
        { text: 'Done', onPress: () => router.replace('/(tabs)') },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Failed'),
  });

  const payMutation = useMutation({
    mutationFn: () => { router.push(`/payment/${id}` as any); return Promise.resolve(); },
  });

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!tx) return <View style={styles.center}><Text style={styles.notFound}>Transaction not found</Text></View>;

  const isBuyer = tx.buyer_id === user?.id;
  const steps = buildSteps(tx, isBuyer);
  const escrowMs = tx.escrow_hold_until ? new Date(tx.escrow_hold_until).getTime() - now : null;
  const canConfirm = isBuyer && tx.payment_status === 'held' && tx.dispute_status === 'none';
  const canDispute = (isBuyer || !isBuyer) && tx.payment_status === 'held' && tx.dispute_status === 'none';
  const canPay = isBuyer && tx.payment_status === 'pending';
  const isComplete = ['released', 'refunded'].includes(tx.payment_status) || tx.dispute_status.startsWith('resolved');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Listing summary */}
        <View style={styles.card}>
          <View style={styles.listingRow}>
            <Image
              source={{ uri: tx.listing_image || 'https://via.placeholder.com/80' }}
              style={styles.listingImg}
            />
            <View style={styles.listingInfo}>
              <Text style={styles.listingTitle} numberOfLines={2}>{tx.listing_title}</Text>
              <Text style={styles.agreedPrice}>{Number(tx.agreed_price)?.toLocaleString()} EGP</Text>
              <Text style={styles.sellerReceives}>
                {isBuyer ? `Seller receives: ${Number(tx.seller_receives)?.toLocaleString()} EGP` : `You receive: ${Number(tx.seller_receives)?.toLocaleString()} EGP`}
              </Text>
            </View>
          </View>

          <View style={styles.partiesRow}>
            <View style={styles.party}>
              <Ionicons name="person-outline" size={13} color={COLORS.textTertiary} />
              <Text style={styles.partyLabel}>Buyer</Text>
              <Text style={styles.partyName}>{tx.buyer_name}{isBuyer ? ' (you)' : ''}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#CCC" />
            <View style={styles.party}>
              <Ionicons name="storefront-outline" size={13} color={COLORS.textTertiary} />
              <Text style={styles.partyLabel}>Seller</Text>
              <Text style={styles.partyName}>{tx.seller_name}{!isBuyer ? ' (you)' : ''}</Text>
            </View>
          </View>
        </View>

        {/* Escrow countdown */}
        {tx.payment_status === 'held' && escrowMs !== null && tx.dispute_status === 'none' && (
          <View style={[styles.countdownCard, { backgroundColor: escrowMs < 86400000 ? '#FFF8F0' : COLORS.primaryLight }]}>
            <Ionicons
              name={escrowMs < 86400000 ? 'timer-outline' : 'shield-checkmark'}
              size={18}
              color={escrowMs < 86400000 ? '#F59E0B' : COLORS.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.countdownLabel, { color: escrowMs < 86400000 ? '#F59E0B' : COLORS.primary }]}>
                {escrowMs <= 0 ? 'Auto-release pending' : `Escrow releases in ${msToCountdown(escrowMs)}`}
              </Text>
              <Text style={styles.countdownSub}>
                {isBuyer
                  ? 'Confirm receipt early to release payment to the seller.'
                  : 'Waiting for buyer to confirm receipt.'}
              </Text>
            </View>
          </View>
        )}

        {/* Status stepper */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          {steps.map((step, i) => (
            <View key={step.key} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={[
                  styles.stepDot,
                  step.done && styles.stepDotDone,
                  step.active && styles.stepDotActive,
                ]}>
                  <Ionicons
                    name={step.icon as any}
                    size={14}
                    color={step.done || step.active ? '#fff' : '#CCC'}
                  />
                </View>
                {i < steps.length - 1 && (
                  <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
                )}
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepLabel, (step.done || step.active) && styles.stepLabelActive]}>
                  {step.label}
                </Text>
                <Text style={styles.stepSub}>{step.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Dispute info */}
        {tx.dispute_status !== 'none' && (
          <View style={styles.disputeCard}>
            <View style={styles.disputeHeader}>
              <Ionicons name="warning" size={18} color="#E53935" />
              <Text style={styles.disputeTitle}>Dispute Opened</Text>
            </View>
            <Text style={styles.disputeReason}>{tx.dispute_reason ?? '—'}</Text>
            <Text style={styles.disputeStatus}>
              Status: {tx.dispute_status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </Text>
          </View>
        )}

        {/* Actions */}
        {canPay && (
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Action Required</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push(`/payment/${id}` as any)}>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Pay {Number(tx.agreed_price)?.toLocaleString()} EGP</Text>
            </TouchableOpacity>
          </View>
        )}

        {canConfirm && (
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Confirm Receipt</Text>
            <Text style={styles.actionDesc}>Have you received the item in the described condition?</Text>
            <View style={styles.actionRow}>
              {canDispute && (
                <TouchableOpacity
                  style={styles.disputeBtn}
                  onPress={() => router.push(`/dispute/${id}` as any)}
                >
                  <Ionicons name="warning-outline" size={16} color={COLORS.error} />
                  <Text style={styles.disputeBtnText}>Open Dispute</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => Alert.alert('Confirm Receipt', 'Release payment to the seller?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Confirm', onPress: () => confirmMutation.mutate() },
                ])}
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.confirmBtnText}>Confirm & Release</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isComplete && !tx.has_review && (
          <TouchableOpacity style={styles.reviewBanner} onPress={() => router.push(`/review/${id}` as any)}>
            <Ionicons name="star" size={18} color="#F59E0B" />
            <Text style={styles.reviewBannerText}>Leave a review for this transaction</Text>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: COLORS.textSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', ...SHADOWS.sm,
  },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  scroll: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.lg, ...SHADOWS.sm },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  listingRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  listingImg: { width: 80, height: 80, borderRadius: RADIUS.sm, backgroundColor: '#F0F0F0' },
  listingInfo: { flex: 1, gap: 3 },
  listingTitle: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text, lineHeight: 20 },
  agreedPrice: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: '900', color: COLORS.primary },
  sellerReceives: { fontSize: 12, color: COLORS.textTertiary },
  partiesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  party: { alignItems: 'center', gap: 2, flex: 1 },
  partyLabel: { fontSize: 11, color: COLORS.textTertiary },
  partyName: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  countdownCard: {
    borderRadius: RADIUS.md, padding: SPACING.md,
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
  },
  countdownLabel: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold },
  countdownSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  // Stepper
  stepRow: { flexDirection: 'row', gap: SPACING.md, minHeight: 52 },
  stepLeft: { alignItems: 'center', width: 28 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: COLORS.success },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepLine: { flex: 1, width: 2, backgroundColor: '#E0E0E0', marginTop: 2 },
  stepLineDone: { backgroundColor: COLORS.success },
  stepContent: { flex: 1, paddingBottom: SPACING.md },
  stepLabel: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.textSecondary },
  stepLabelActive: { color: COLORS.text },
  stepSub: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2, lineHeight: 16 },
  // Dispute card
  disputeCard: { backgroundColor: '#FEF2F2', borderRadius: RADIUS.md, padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.error },
  disputeHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  disputeTitle: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.error },
  disputeReason: { fontSize: TYPOGRAPHY.fontSizeSM, color: '#B91C1C', lineHeight: 18 },
  disputeStatus: { fontSize: 12, color: '#9CA3AF', marginTop: SPACING.xs },
  // Actions
  actionsCard: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.lg, ...SHADOWS.sm },
  actionDesc: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, marginBottom: SPACING.md },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  disputeBtn: {
    flex: 1, height: 48, borderRadius: RADIUS.md, borderWidth: 1.5,
    borderColor: COLORS.error, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: SPACING.xs,
  },
  disputeBtnText: { color: COLORS.error, fontWeight: '600', fontSize: TYPOGRAPHY.fontSizeSM },
  confirmBtn: {
    flex: 1.5, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
  },
  confirmBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeSM },
  primaryBtn: {
    height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  primaryBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },
  reviewBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#FFFBEB', borderRadius: RADIUS.md, padding: SPACING.md,
  },
  reviewBannerText: { flex: 1, fontSize: TYPOGRAPHY.fontSizeMD, color: '#92400E', fontWeight: '500' },
});
