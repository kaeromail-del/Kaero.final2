import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Avatar } from '../../components/ui/Avatar';
import { Stars } from '../../components/ui/Stars';
import { uploadService } from '../../services/upload.service';
import api from '../../services/api';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();
  const { lang, isDark, setLang, toggleDark } = useSettingsStore();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch('/users/me', data).then(r => r.data.user),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      setEditing(false);
      Alert.alert('Saved', 'Profile updated');
    },
    onError: () => Alert.alert('Error', 'Failed to update profile'),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['user-reviews', user?.id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${user?.id}/reviews`);
      return data;
    },
    enabled: !!user,
  });

  const handleAvatarChange = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setAvatarUploading(true);
    try {
      const url = await uploadService.uploadImage(result.assets[0].uri);
      await api.patch('/users/me', { avatar_url: url });
      updateUser({ avatar_url: url });
    } catch {
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleSave = () => {
    if (!fullName.trim()) { Alert.alert('Name required'); return; }
    updateMutation.mutate({ full_name: fullName.trim(), email: email.trim() || null });
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-EG', { month: 'long', year: 'numeric' })
    : '';

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarSection}>
          {/* Tappable avatar with camera overlay */}
          <TouchableOpacity onPress={handleAvatarChange} style={styles.avatarWrap} disabled={avatarUploading}>
            <Avatar name={user?.full_name} uri={user?.avatar_url} size={80} color={COLORS.primary} />
            <View style={styles.cameraOverlay}>
              {avatarUploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />
              }
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            {editing ? (
              <TextInput
                style={styles.nameInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full name"
                autoFocus
              />
            ) : (
              <Text style={styles.profileName}>{user?.full_name || 'Complete Profile'}</Text>
            )}
            <Text style={styles.profilePhone}>{user?.phone}</Text>
            <View style={styles.badgesRow}>
              {user?.is_phone_verified && (
                <View style={styles.badge}><Text style={styles.badgeText}>✓ Phone</Text></View>
              )}
              {user?.is_id_verified && (
                <View style={[styles.badge, styles.badgeGold]}><Text style={styles.badgeText}>✓ ID</Text></View>
              )}
            </View>
          </View>
        </View>

        {editing ? (
          <>
            <TextInput
              style={styles.emailInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Email (optional)"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setFullName(user?.full_name ?? ''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Ionicons name="pencil" size={16} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trust score */}
      <View style={styles.section}>
        <View style={styles.trustRow}>
          <View style={styles.trustScore}>
            <Text style={styles.trustNumber}>{(user?.trust_score ?? 5).toFixed(1)}</Text>
            <Stars rating={user?.trust_score ?? 5} size={16} />
            <Text style={styles.trustLabel}>Trust Score</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustReviews}>
            <Text style={styles.trustNumber}>{user?.total_reviews ?? 0}</Text>
            <Text style={styles.trustLabel}>Reviews</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustMember}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.trustLabel}>Since {memberSince}</Text>
          </View>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="language" size={20} color={COLORS.primary} />
            <Text style={styles.settingLabel}>Language</Text>
          </View>
          <View style={styles.langRow}>
            {(['en', 'ar'] as const).map(l => (
              <TouchableOpacity
                key={l}
                style={[styles.langBtn, lang === l && styles.langActive]}
                onPress={() => setLang(l)}
              >
                <Text style={[styles.langText, lang === l && styles.langActiveText]}>
                  {l === 'en' ? 'EN' : 'ع'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={COLORS.primary} />
            <Text style={styles.settingLabel}>Dark Mode</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleDark}
            trackColor={{ true: COLORS.primary, false: '#DDD' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Account actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {[
          { icon: 'heart-outline',              label: 'Saved Listings',    action: () => router.push('/favorites') },
          { icon: 'pricetag-outline',           label: 'My Offers',         action: () => router.push('/offers' as any) },
          { icon: 'receipt-outline',            label: 'My Transactions',   action: () => router.push('/transactions' as any) },
          { icon: 'wallet-outline',             label: 'My Wallet',         action: () => router.push('/wallet' as any) },
          { icon: 'gift-outline',               label: 'Refer & Earn',      action: () => router.push('/referral' as any) },
          { icon: 'notifications-outline',      label: 'Notifications',     action: () => router.push('/notifications') },
          { icon: 'sparkles-outline',           label: 'AI Assistant',      action: () => router.push('/ai-assistant' as any) },
          { icon: 'shield-checkmark-outline',   label: 'Verify My ID',      action: () => router.push('/verify-id' as any) },
          { icon: 'document-text-outline',      label: 'Privacy Policy',    action: () => router.push('/privacy-policy' as any) },
          { icon: 'shield-outline',             label: 'Terms of Service',  action: () => router.push('/terms' as any) },
          { icon: 'help-circle-outline',        label: 'Help & Support',    action: () => {} },
          { icon: 'information-circle-outline', label: 'About Kaero',       action: () => {} },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.actionRow} onPress={item.action}>
            <View style={styles.settingLeft}>
              <Ionicons name={item.icon as any} size={20} color={COLORS.textSecondary} />
              <Text style={styles.settingLabel}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CCC" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Kaero v0.51 • Made with ❤️ for Egypt</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  profileCard: { backgroundColor: '#fff', padding: SPACING.lg, ...SHADOWS.sm, marginBottom: SPACING.sm },
  avatarSection: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  avatarWrap: { position: 'relative' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1, justifyContent: 'center' },
  profileName: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  profilePhone: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, marginTop: 2 },
  badgesRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs },
  badge: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeGold: { backgroundColor: '#FFF9E6' },
  badgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  nameInput: { borderBottomWidth: 1.5, borderBottomColor: COLORS.primary, fontSize: TYPOGRAPHY.fontSizeLG, paddingVertical: 4, marginBottom: SPACING.xs },
  emailInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: TYPOGRAPHY.fontSizeMD, marginBottom: SPACING.md },
  editActions: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: { flex: 1, height: 40, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: COLORS.textSecondary },
  saveBtn: { flex: 1, height: 40, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start' },
  editBtnText: { color: COLORS.primary, fontWeight: '600' },
  section: { backgroundColor: '#fff', padding: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md },
  trustRow: { flexDirection: 'row', justifyContent: 'space-around' },
  trustScore: { alignItems: 'center', gap: 4 },
  trustReviews: { alignItems: 'center', gap: 4 },
  trustMember: { alignItems: 'center', gap: 4 },
  trustNumber: { fontSize: TYPOGRAPHY.fontSizeXXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  trustLabel: { fontSize: 12, color: COLORS.textSecondary },
  trustDivider: { width: 1, backgroundColor: '#F0F0F0' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  settingLabel: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  langRow: { flexDirection: 'row', gap: SPACING.xs },
  langBtn: { width: 36, height: 32, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  langActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  langText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, fontWeight: '600' },
  langActiveText: { color: COLORS.primary },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: '#FEF2F2', margin: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md,
  },
  logoutText: { color: COLORS.error, fontWeight: '700', fontSize: TYPOGRAPHY.fontSizeMD },
  version: { textAlign: 'center', color: '#CCC', fontSize: 12, paddingBottom: 100 },
});
