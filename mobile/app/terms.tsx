import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';

const sections = [
  {
    title: 'Acceptance',
    body: 'By using Kaero you agree to these terms.',
  },
  {
    title: 'Marketplace Rules',
    body: 'Only list items you own. No prohibited items (weapons, drugs, stolen goods, adult content). Prices must be in EGP.',
  },
  {
    title: 'Fees',
    body: 'Kaero charges a 4% platform fee on completed transactions, split between buyer and seller.',
  },
  {
    title: 'Escrow',
    body: 'Payments are held in escrow until the buyer confirms receipt. Release is automatic after 72 hours of no dispute.',
  },
  {
    title: 'Prohibited Items',
    body: 'Firearms, drugs, counterfeit goods, stolen items, adult content, live animals.',
  },
  {
    title: 'Disputes',
    body: "Open a dispute within 3 days of delivery. Kaero's decision is final.",
  },
  {
    title: 'Account Termination',
    body: 'We may suspend accounts that violate these terms.',
  },
  {
    title: 'Limitation of Liability',
    body: 'Kaero is a marketplace platform. We are not responsible for item quality or seller/buyer conduct.',
  },
  {
    title: 'Governing Law',
    body: 'These terms are governed by Egyptian law.',
  },
  {
    title: 'Contact',
    body: 'legal@kaero.app',
  },
];

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Terms of Service', headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Terms of Service</Text>
        <Text style={styles.lastUpdated}>Last updated: February 2026</Text>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Kaero — Cairo, Egypt</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  lastUpdated: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.xxl,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  sectionHeader: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
    lineHeight: TYPOGRAPHY.lineHeightLG,
  },
  footer: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
  },
});
