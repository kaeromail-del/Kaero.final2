import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../constants/theme';
import { walletService, WalletTx } from '../services/wallet.service';

// ─── Helpers ─────────────────────────────────────────────

const TX_CONFIG: Record<string, { icon: string; color: string; sign: string }> = {
  credit: { icon: 'arrow-down-circle', color: COLORS.success, sign: '+' },
  debit: { icon: 'arrow-up-circle', color: COLORS.error, sign: '-' },
  fee: { icon: 'remove-circle', color: '#6B7280', sign: '-' },
  withdrawal: { icon: 'cash-outline', color: '#7C3AED', sign: '-' },
  referral_bonus: { icon: 'gift', color: '#F59E0B', sign: '+' },
  promo_credit: { icon: 'ticket', color: COLORS.primary, sign: '+' },
};

const METHOD_LABELS: Record<string, { label: string; icon: string; placeholder: string }> = {
  bank_transfer: { label: 'Bank Transfer', icon: '🏦', placeholder: 'Account number + bank name' },
  vodafone_cash: { label: 'Vodafone Cash', icon: '📱', placeholder: 'Vodafone number (01X-XXXXXXXX)' },
  instapay: { label: 'InstaPay', icon: '⚡', placeholder: 'InstaPay ID or phone' },
  fawry: { label: 'Fawry', icon: '🟠', placeholder: 'Fawry reference number' },
};

function TxRow({ tx }: { tx: WalletTx }) {
  const cfg = TX_CONFIG[tx.type] ?? { icon: 'ellipse', color: '#999', sign: '' };
  const isCredit = cfg.sign === '+';
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: cfg.color + '18' }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txDesc} numberOfLines={1}>{tx.description || tx.type.replace(/_/g, ' ')}</Text>
        <Text style={styles.txDate}>
          {new Date(tx.created_at).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
          {tx.status !== 'completed' && ` · ${tx.status}`}
        </Text>
      </View>
      <Text style={[styles.txAmount, { color: isCredit ? COLORS.success : COLORS.text }]}>
        {cfg.sign}{Number(tx.amount).toLocaleString()} EGP
      </Text>
    </View>
  );
}

// ─── Withdraw modal ───────────────────────────────────────

function WithdrawModal({
  visible, balance, onClose, onSuccess,
}: {
  visible: boolean; balance: number; onClose: () => void; onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('instapay');
  const [accountName, setAccountName] = useState('');
  const [accountDetails, setAccountDetails] = useState('');

  const mutation = useMutation({
    mutationFn: () => walletService.requestWithdrawal({
      amount: parseFloat(amount),
      method: method as any,
      account_details: {
        account_name: accountName,
        [method === 'bank_transfer' ? 'account_number' : 'phone_number']: accountDetails,
        ...(method === 'bank_transfer' ? { bank_name: '' } : {}),
      },
    }),
    onSuccess: () => {
      Alert.alert('Request Submitted', 'Your withdrawal will be processed within 1–3 business days.');
      onSuccess();
      onClose();
      setAmount(''); setAccountName(''); setAccountDetails('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Withdrawal failed'),
  });

  const numAmount = parseFloat(amount) || 0;
  const canSubmit = numAmount >= 100 && numAmount <= balance && accountName.trim() && accountDetails.trim() && !mutation.isPending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Withdraw Funds</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={{ gap: SPACING.md, padding: SPACING.lg }}>
          {/* Balance */}
          <View style={styles.modalBalance}>
            <Text style={styles.modalBalanceLabel}>Available Balance</Text>
            <Text style={styles.modalBalanceAmount}>{balance.toLocaleString()} EGP</Text>
          </View>

          {/* Amount */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Amount (min. 100 EGP)</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor="#B0B0B0"
              />
              <TouchableOpacity style={styles.maxBtn} onPress={() => setAmount(String(Math.floor(balance)))}>
                <Text style={styles.maxBtnText}>Max</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Method picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Payment Method</Text>
            <View style={styles.methodGrid}>
              {Object.entries(METHOD_LABELS).map(([key, m]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.methodChip, method === key && styles.methodChipActive]}
                  onPress={() => setMethod(key)}
                >
                  <Text style={styles.methodChipIcon}>{m.icon}</Text>
                  <Text style={[styles.methodChipLabel, method === key && styles.methodChipLabelActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Account details */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Account Name</Text>
            <TextInput
              style={styles.input}
              value={accountName}
              onChangeText={setAccountName}
              placeholder="Full name on account"
              placeholderTextColor="#B0B0B0"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{METHOD_LABELS[method]?.label} Details</Text>
            <TextInput
              style={styles.input}
              value={accountDetails}
              onChangeText={setAccountDetails}
              placeholder={METHOD_LABELS[method]?.placeholder}
              placeholderTextColor="#B0B0B0"
              keyboardType={method !== 'bank_transfer' ? 'phone-pad' : 'default'}
            />
          </View>

          <View style={styles.withdrawNote}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.textTertiary} />
            <Text style={styles.withdrawNoteText}>
              Withdrawals are processed manually within 1–3 business days. A 2% processing fee applies for bank transfers.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={() => mutation.mutate()}
            disabled={!canSubmit}
          >
            {mutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>Request Withdrawal of {numAmount > 0 ? numAmount.toLocaleString() : '—'} EGP</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [tab, setTab] = useState<'transactions' | 'withdrawals'>('transactions');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletService.getSummary(),
  });

  const { data: withdrawals } = useQuery({
    queryKey: ['withdrawals'],
    queryFn: () => walletService.getWithdrawals(),
    enabled: tab === 'withdrawals',
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />
        }
        scrollEventThrottle={16}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              {isLoading
                ? <View style={styles.balanceSkeleton} />
                : <Text style={styles.balanceAmount}>{Number(data?.balance ?? 0).toLocaleString()} EGP</Text>
              }
              {(data?.pending ?? 0) > 0 && (
                <Text style={styles.pendingText}>+{Number(data!.pending).toLocaleString()} EGP pending</Text>
              )}
            </View>
            <View style={styles.balanceIcon}>
              <Ionicons name="wallet" size={32} color={COLORS.primary} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.withdrawBtn, (!data?.balance || data.balance < 100) && styles.withdrawBtnDisabled]}
            onPress={() => setShowWithdraw(true)}
            disabled={!data?.balance || data.balance < 100}
          >
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text style={styles.withdrawBtnText}>Withdraw Funds</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        {!isLoading && data && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statAmount}>{Number(data.total_earned).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Earned (EGP)</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statAmount}>{Number(data.total_withdrawn).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Withdrawn (EGP)</Text>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['transactions', 'withdrawals'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'transactions' ? 'Transactions' : 'Withdrawals'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction list */}
        {tab === 'transactions' && (
          <View style={styles.listCard}>
            {isLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ padding: SPACING.xl }} />
            ) : !data?.recent_transactions?.length ? (
              <View style={styles.empty}>
                <Ionicons name="wallet-outline" size={40} color={COLORS.iconDefault} />
                <Text style={styles.emptyText}>No wallet activity yet</Text>
                <Text style={styles.emptySubText}>Earnings from sales will appear here</Text>
              </View>
            ) : (
              data.recent_transactions.map(tx => <TxRow key={tx.id} tx={tx} />)
            )}
          </View>
        )}

        {/* Withdrawals list */}
        {tab === 'withdrawals' && (
          <View style={styles.listCard}>
            {!withdrawals?.length ? (
              <View style={styles.empty}>
                <Ionicons name="cash-outline" size={40} color={COLORS.iconDefault} />
                <Text style={styles.emptyText}>No withdrawals yet</Text>
              </View>
            ) : (
              withdrawals.map(w => (
                <View key={w.id} style={styles.withdrawRow}>
                  <View style={styles.withdrawRowLeft}>
                    <Text style={styles.withdrawAmount}>{Number(w.amount).toLocaleString()} EGP</Text>
                    <Text style={styles.withdrawMethod}>{METHOD_LABELS[w.method]?.label ?? w.method}</Text>
                  </View>
                  <View>
                    <View style={[
                      styles.withdrawStatus,
                      w.status === 'completed' && styles.withdrawStatusDone,
                      w.status === 'rejected' && styles.withdrawStatusRejected,
                    ]}>
                      <Text style={[
                        styles.withdrawStatusText,
                        w.status === 'completed' && styles.withdrawStatusTextDone,
                        w.status === 'rejected' && styles.withdrawStatusTextRejected,
                      ]}>
                        {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.withdrawDate}>
                      {new Date(w.created_at).toLocaleDateString('en-EG', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Paymob info card */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Secure Payments via Paymob</Text>
            <Text style={styles.infoDesc}>
              All card payments are processed securely by Paymob, Egypt's leading payment gateway. Kaero never stores your card details.
            </Text>
          </View>
        </View>

      </ScrollView>

      <WithdrawModal
        visible={showWithdraw}
        balance={Number(data?.balance ?? 0)}
        onClose={() => setShowWithdraw(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['wallet'] })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.separator, ...SHADOWS.sm,
  },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  scroll: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 60 },

  // Balance card
  balanceCard: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.xl },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  balanceLabel: { fontSize: TYPOGRAPHY.fontSizeSM, color: 'rgba(255,255,255,0.8)', marginBottom: SPACING.xs },
  balanceSkeleton: { height: 40, width: 160, borderRadius: RADIUS.sm, backgroundColor: 'rgba(255,255,255,0.2)' },
  balanceAmount: { fontSize: 36, fontWeight: '900', color: '#fff' },
  pendingText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  balanceIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  withdrawBtn: { height: 48, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  withdrawBtnDisabled: { opacity: 0.4 },
  withdrawBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.lg, ...SHADOWS.sm },
  statBox: { flex: 1, alignItems: 'center' },
  statAmount: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.separator },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 4, ...SHADOWS.sm },
  tab: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: RADIUS.sm - 2 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },

  // List
  listCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, ...SHADOWS.sm, overflow: 'hidden' },
  empty: { padding: SPACING.xl * 1.5, alignItems: 'center', gap: SPACING.sm },
  emptyText: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '600', color: COLORS.textSecondary },
  emptySubText: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center' },

  // Transaction row
  txRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.text },
  txDate: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2, textTransform: 'capitalize' },
  txAmount: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '700' },

  // Withdrawal row
  withdrawRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  withdrawRowLeft: { gap: 2 },
  withdrawAmount: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '700', color: COLORS.text },
  withdrawMethod: { fontSize: 12, color: COLORS.textTertiary },
  withdrawStatus: { backgroundColor: '#F3F4F6', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-end' },
  withdrawStatusDone: { backgroundColor: '#ECFDF5' },
  withdrawStatusRejected: { backgroundColor: '#FEF2F2' },
  withdrawStatusText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  withdrawStatusTextDone: { color: COLORS.success },
  withdrawStatusTextRejected: { color: COLORS.error },
  withdrawDate: { fontSize: 11, color: COLORS.textTertiary, marginTop: 3, textAlign: 'right' },

  // Info card
  infoCard: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.md },
  infoTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.primary, marginBottom: 2 },
  infoDesc: { fontSize: 12, color: COLORS.primaryDark, lineHeight: 16 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.cardBg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.separator },
  modalTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  modalScroll: { flex: 1 },
  modalBalance: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.lg, alignItems: 'center' },
  modalBalanceLabel: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.primary },
  modalBalanceAmount: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  fieldGroup: { gap: SPACING.xs },
  fieldLabel: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600', color: COLORS.textSecondary },
  input: { height: 48, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  amountRow: { flexDirection: 'row', gap: SPACING.sm },
  amountInput: { flex: 1, height: 48, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, fontSize: 24, fontWeight: '700', color: COLORS.text },
  maxBtn: { height: 48, paddingHorizontal: SPACING.md, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  maxBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: TYPOGRAPHY.fontSizeSM },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  methodChip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: '#E0E0E0' },
  methodChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  methodChipIcon: { fontSize: 18 },
  methodChipLabel: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, fontWeight: '600' },
  methodChipLabelActive: { color: COLORS.primary },
  withdrawNote: { flexDirection: 'row', gap: SPACING.xs, alignItems: 'flex-start', backgroundColor: '#F9FAFB', borderRadius: RADIUS.sm, padding: SPACING.sm },
  withdrawNoteText: { flex: 1, fontSize: 12, color: COLORS.textTertiary, lineHeight: 16 },
  submitBtn: { height: 54, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold, fontSize: TYPOGRAPHY.fontSizeMD },
});
