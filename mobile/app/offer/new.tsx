import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, PAYMENT_LABELS } from '../../constants/theme';
import { offerService } from '../../services/offer.service';
import { listingService } from '../../services/listing.service';

const QUICK_AMOUNTS = [0.9, 0.85, 0.8, 0.75]; // % of listing price

export default function MakeOfferScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [isExchange, setIsExchange] = useState(false);

  const { data: listing } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => listingService.getById(listingId),
    enabled: !!listingId,
  });

  const offerMutation = useMutation({
    mutationFn: () => offerService.create({
      listing_id: listingId,
      offered_price: Number(price),
      message: message.trim() || undefined,
      is_exchange_proposal: isExchange,
    }),
    onSuccess: () => {
      Alert.alert('Offer Sent!', 'The seller will review your offer and respond shortly.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Failed to send offer'),
  });

  const askingPrice = listing?.final_price ?? 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Handle bar */}
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Make an Offer</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Listing summary */}
          {listing && (
            <View style={styles.listingSummary}>
              <Text style={styles.listingName} numberOfLines={2}>{listing.user_edited_title}</Text>
              <Text style={styles.askingLabel}>Asking price</Text>
              <Text style={styles.askingPrice}>{askingPrice.toLocaleString()} EGP</Text>
            </View>
          )}

          {/* Quick amounts */}
          {askingPrice > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Quick Select</Text>
              <View style={styles.quickRow}>
                {QUICK_AMOUNTS.map(pct => {
                  const amt = Math.round(askingPrice * pct);
                  return (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.quickBtn, price === String(amt) && styles.quickBtnActive]}
                      onPress={() => setPrice(String(amt))}
                    >
                      <Text style={[styles.quickPct, price === String(amt) && styles.quickPctActive]}>
                        {Math.round(pct * 100)}%
                      </Text>
                      <Text style={[styles.quickAmt, price === String(amt) && styles.quickAmtActive]}>
                        {amt.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Price input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your Offer (EGP) *</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder={askingPrice > 0 ? String(Math.round(askingPrice * 0.85)) : '0'}
                placeholderTextColor="#AAA"
                autoFocus
              />
              <Text style={styles.currency}>EGP</Text>
            </View>
            {price && askingPrice > 0 && (
              <Text style={styles.savingText}>
                {Number(price) < askingPrice
                  ? `You save: ${(askingPrice - Number(price)).toLocaleString()} EGP (${Math.round((1 - Number(price) / askingPrice) * 100)}% off)`
                  : Number(price) > askingPrice
                    ? `Above asking price by ${(Number(price) - askingPrice).toLocaleString()} EGP`
                    : 'Equal to asking price'}
              </Text>
            )}
          </View>

          {/* Message */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Message (optional)</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Hi, is this still available? Can you do..."
              multiline
              numberOfLines={3}
              maxLength={300}
              textAlignVertical="top"
              placeholderTextColor="#AAA"
            />
          </View>

          {/* Exchange option */}
          <TouchableOpacity
            style={[styles.exchangeRow, isExchange && styles.exchangeActive]}
            onPress={() => setIsExchange(e => !e)}
          >
            <View style={styles.exchangeLeft}>
              <Ionicons name="swap-horizontal" size={20} color={isExchange ? COLORS.primary : COLORS.textSecondary} />
              <View>
                <Text style={[styles.exchangeLabel, isExchange && { color: COLORS.primary }]}>Propose Exchange</Text>
                <Text style={styles.exchangeSub}>Offer to trade something you have</Text>
              </View>
            </View>
            <View style={[styles.checkbox, isExchange && styles.checkboxActive]}>
              {isExchange && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>

          {/* Escrow info */}
          <View style={styles.escrowInfo}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
            <Text style={styles.escrowText}>
              If accepted, payment is held in escrow for 3 days. Release after confirming receipt.
            </Text>
          </View>
        </ScrollView>

        {/* Submit */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <TouchableOpacity
            style={[styles.submitBtn, (!price || Number(price) <= 0 || offerMutation.isPending) && styles.submitBtnDisabled]}
            onPress={() => offerMutation.mutate()}
            disabled={!price || Number(price) <= 0 || offerMutation.isPending}
          >
            {offerMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>Send Offer</Text>
              </>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: SPACING.sm, marginBottom: SPACING.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  scroll: { flex: 1 },
  listingSummary: { padding: SPACING.lg, backgroundColor: COLORS.primaryLight, margin: SPACING.lg, borderRadius: RADIUS.md },
  listingName: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text, marginBottom: SPACING.xs },
  askingLabel: { fontSize: 12, color: COLORS.textSecondary },
  askingPrice: { fontSize: TYPOGRAPHY.fontSizeXXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.primary },
  section: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  sectionLabel: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  quickRow: { flexDirection: 'row', gap: SPACING.sm },
  quickBtn: {
    flex: 1, padding: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center',
  },
  quickBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  quickPct: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, fontWeight: '600' },
  quickPctActive: { color: COLORS.primary },
  quickAmt: { fontSize: TYPOGRAPHY.fontSizeXS, color: '#999', marginTop: 2 },
  quickAmtActive: { color: COLORS.primaryDark },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  priceInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, height: 56,
    fontSize: 24, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text,
  },
  currency: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.textSecondary },
  savingText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.success, marginTop: SPACING.xs, fontWeight: '500' },
  messageInput: {
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, height: 90,
    fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text,
  },
  exchangeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: SPACING.lg, padding: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: '#E0E0E0',
    marginBottom: SPACING.md,
  },
  exchangeActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  exchangeLeft: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  exchangeLabel: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '600', color: COLORS.text },
  exchangeSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  escrowInfo: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight, margin: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.sm,
  },
  escrowText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 18 },
  footer: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  submitBtn: {
    height: 56, backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold },
});
