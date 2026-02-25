import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';

const sections = [
  {
    title: 'Introduction',
    body: "Kaero ('we', 'us') operates the Kaero marketplace app. This policy explains how we collect, use, and protect your data.",
  },
  {
    title: 'Data We Collect',
    body: 'Phone number (for authentication), location data (to show nearby listings), photos you upload, device information, transaction history.',
  },
  {
    title: 'How We Use Your Data',
    body: 'To provide marketplace services, verify identity, prevent fraud, send notifications about your listings and offers, improve recommendations.',
  },
  {
    title: 'Data Sharing',
    body: 'We do not sell your data. We share data with: payment processors (Paymob) for transactions, SMS providers for OTP, and law enforcement when legally required.',
  },
  {
    title: 'Data Retention',
    body: 'Account data is retained while your account is active. You may request deletion by contacting support@kaero.app.',
  },
  {
    title: 'Your Rights',
    body: 'You may access, correct, or delete your personal data. Contact us at privacy@kaero.app.',
  },
  {
    title: 'Contact',
    body: 'Email: privacy@kaero.app\nAddress: Cairo, Egypt',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Privacy Policy', headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Privacy Policy</Text>
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
