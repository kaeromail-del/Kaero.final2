import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, PAYMENT_LABELS } from '../../constants/theme';
import { transactionService } from '../../services/transaction.service';
import { referralService } from '../../services/referral.service';

const PAYMENT_METHODS = ['cash', 'fawry', 'instapay', 'vodafone_cash', 'wallet'] as const;

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<{ discount_amount: number; final_amount: number; code: string } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionService.getById(id),
    enabled: !!id,
  });

  const payMutation = useMutation({
    mutationFn: () => transactionService.initiatePayment(id, selectedMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      Alert.alert(
        'Payment Initiated',
        `Your payment via ${PAYMENT_LABELS[selectedMethod]?.en} is being processed. Funds will be held in escrow for 3 days.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Payment failed'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => transactionService.confirmReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      Alert.alert('Confirmed!', 'Payment released to the seller. Leave a review?', [
        { text: 'Leave Review', onPress: () => router.replace(`/review/${id}` as any) },
        { text: 'Done', style: 'cancel', onPress: () => router.replace('/(tabs)') },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Failed to confirm'),
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!transaction) {
    return <View style={styles.center}><Text style={{ color: COLORS.textSecondary }}>Transaction not found</Text></View>;
  }

  const platformFee = transaction.platform_fee ?? transaction.agreed_price * 0.04;
  const baseTotal = transaction.agreed_price;
  const discount = promoResult?.discount_amount ?? 0;
  const total = promoResult?.final_amount ?? baseTotal;
  const status = transaction.payment_status;

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const result = await referralService.validatePromo(promoCode.trim(), baseTotal);
      setPromoResult(result);
    } catch (e: any) {
      Alert.alert('Invalid Code', e?.response?.data?.error ?? 'Promo code not valid.');
      setPromoResult(null);
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Order summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          <Text style={styles.listingTitle} numberOfLines={2}>{transaction.listing_title}</Text>

          <View style={styles.breakdownRows}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Item price</Text>
              <Text style={styles.breakdownValue}>{baseTotal?.toLocaleString()} EGP</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Platform fee (4%)</Text>
              <Text style={styles.breakdownValue}>{Math.round(platformFee).toLocaleString()} EGP</Text>
            </View>
            {discount > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: COLORS.success }]}>
                  Promo ({promoResult!.code})
                </Text>
                <Text style={[styles.breakdownValue, { color: COLORS.success }]}>
                  -{Math.round(discount).toLocaleString()} EGP
                </Text>
              </View>
            )}
            <View style={[styles.breakdownRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>You pay</Text>
              <Text style={styles.totalValue}>{Math.round(total)?.toLocaleString()} EGP</Text>
            </View>
          </View>

          {/* Promo code input — only when pending */}
          {status === 'pending' && (
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                value={promoCode}
                onChangeText={t => { setPromoCode(t.toUpperCase()); setPromoResult(null); }}
                placeholder="Promo code"
                placeholderTextColor="#B0B0B0"
                autoCapitalize="characters"
                maxLength={20}
              />
              <TouchableOpacity
                style={[styles.promoBtn, (!promoCode.trim() || promoLoading) && styles.promoBtnDisabled]}
                onPress={handleValidatePromo}
                disabled={!promoCode.trim() || promoLoading}
              >
                {promoLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.promoBtnText}>{promoResult ? '✓' : 'Apply'}</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Status indicator */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(status) + '20' }]}>
          <Ionicons name={getStatusIcon(status) as any} size={18} color={getStatusColor(status)} />
          <Text style={[styles.statusText, { color: getStatusColor(status) }]}>{getStatusLabel(status)}</Text>
        </View>

        {/* Payment methods (only show if pending) */}
        {status === 'pending' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Method</Text>
            {PAYMENT_METHODS.map(method => {
              const p = PAYMENT_LABELS[method];
              return (
                <TouchableOpacity
                  key={method}
                  style={[styles.methodRow, selectedMethod === method && styles.methodActive]}
                  onPress={() => setSelectedMethod(method)}
                >
                  <Text style={styles.methodIcon}>{p.icon}</Text>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodName}>{p.en}</Text>
                    <Text style={styles.methodSub}>{getMethodDesc(method)}</Text>
                  </View>
                  <View style={[styles.radio, selectedMethod === method && styles.radioActive]}>
                    {selectedMethod === method && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Escrow info */}
        <View style={styles.escrowCard}>
          <View style={styles.escrowRow}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            <Text style={styles.escrowTitle}>3-Day Escrow Protection</Text>
          </View>
          <Text style={styles.escrowText}>
            Your payment is held safely in escrow. Once you confirm receiving the item in good condition,
            the payment is released to the seller. If there's an issue, you can open a dispute.
          </Text>
        </View>

        {/* Confirm receipt (if held) */}
        {status === 'held' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Confirm Receipt</Text>
            <Text style={styles.confirmText}>Have you received the item in the described condition?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.disputeBtn}
                onPress={() => Alert.alert('Open Dispute', 'Open a dispute with Kaero support?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Dispute', style: 'destructive', onPress: () => transactionService.openDispute(id).then(() => router.back()) },
                ])}
              >
                <Text style={styles.disputeText}>Issue with Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Confirm & Release</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Pay button */}
      {status === 'pending' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <TouchableOpacity
            style={[styles.payBtn, (!selectedMethod || payMutation.isPending) && styles.payBtnDisabled]}
            onPress={() => payMutation.mutate()}
            disabled={!selectedMethod || payMutation.isPending}
          >
            {payMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <>
                <Ionicons name="lock-closed" size={18} color="#fff" />
                <Text style={styles.payBtnText}>Pay {total?.toLocaleString()} EGP Securely</Text>
              </>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Awaiting Payment',
    held: 'In Escrow - Awaiting Your Confirmation',
    released: 'Payment Released to Seller',
    refunded: 'Refunded',
    disputed: 'Dispute Under Review',
  };
  return map[status] ?? status;
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: '#FB8C00', held: '#1E88E5', released: '#43A047', refunded: '#6B7280', disputed: '#E53935',
  };
  return map[status] ?? '#999';
}

function getStatusIcon(status: string): string {
  const map: Record<string, string> = {
    pending: 'time-outline', held: 'shield-half', released: 'checkmark-circle', refunded: 'return-down-back', disputed: 'warning',
  };
  return map[status] ?? 'information-circle';
}

function getMethodDesc(method: string): string {
  const map: Record<string, string> = {
    cash: 'Pay in cash when you meet the seller',
    fawry: 'Pay at any Fawry outlet',
    instapay: 'Instant bank transfer',
    vodafone_cash: 'Pay with Vodafone Cash',
    wallet: 'Pay from Kaero wallet',
  };
  return map[method] ?? '';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 120 },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.lg, ...SHADOWS.sm },
  cardTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md },
  listingTitle: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text, marginBottom: SPACING.md },
  breakdownRows: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: SPACING.sm, gap: SPACING.sm },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary },
  breakdownValue: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  totalRow: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: SPACING.sm, marginTop: SPACING.xs },
  totalLabel: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  totalValue: { fontSize: TYPOGRAPHY.fontSizeXXL, fontWeight: '900', color: COLORS.primary },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.md },
  statusText: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightSemiBold },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: '#E0E0E0',
    marginBottom: SPACING.sm,
  },
  methodActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  methodIcon: { fontSize: 24 },
  methodInfo: { flex: 1 },
  methodName: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.text },
  methodSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  escrowCard: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.md },
  escrowRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  escrowTitle: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.primary },
  escrowText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.primaryDark, lineHeight: 18 },
  confirmText: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.textSecondary, marginBottom: SPACING.md },
  confirmActions: { flexDirection: 'row', gap: SPACING.sm },
  disputeBtn: { flex: 1, height: 46, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  disputeText: { color: COLORS.error, fontWeight: '600' },
  confirmBtn: { flex: 1.5, height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },
  promoRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: SPACING.md },
  promoInput: { flex: 1, height: 40, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text, letterSpacing: 1.5 },
  promoBtn: { height: 40, paddingHorizontal: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  promoBtnDisabled: { opacity: 0.45 },
  promoBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeSM },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.lg, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  payBtn: { height: 56, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: '#fff', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold },
});
