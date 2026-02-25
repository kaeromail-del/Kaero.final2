import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../constants/theme';
import { notificationService } from '../services/notification.service';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  new_offer:        { icon: 'pricetag',          color: '#6366F1', bg: '#EEF2FF' },
  offer_accepted:   { icon: 'checkmark-circle',  color: '#22C55E', bg: '#F0FDF4' },
  offer_rejected:   { icon: 'close-circle',      color: '#EF4444', bg: '#FEF2F2' },
  new_message:      { icon: 'chatbubble',         color: '#3B82F6', bg: '#EFF6FF' },
  payment_received: { icon: 'cash',              color: '#10B981', bg: '#ECFDF5' },
  listing_sold:     { icon: 'bag-check',         color: '#F59E0B', bg: '#FFFBEB' },
  review_received:  { icon: 'star',              color: '#F59E0B', bg: '#FFFBEB' },
  default:          { icon: 'notifications',     color: '#6B7280', bg: '#F9FAFB' },
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications(),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const handlePress = async (item: any) => {
    if (!item.is_read) {
      await notificationService.markRead(item.id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    const nav = item.data ?? {};
    if (nav.screen === 'chat' && nav.chatId) router.push(`/chat/${nav.chatId}`);
    else if (nav.screen === 'payment' && nav.transactionId) router.push(`/payment/${nav.transactionId}`);
    else if (nav.screen === 'listing' && nav.listingId) router.push(`/listing/${nav.listingId}`);
    else if (nav.screen === 'profile') router.push('/(tabs)/profile');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 80 }} />}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>We'll notify you about offers, messages, and transactions.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.default;
            return (
              <TouchableOpacity
                style={[styles.item, !item.is_read && styles.itemUnread]}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
                  <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
                </View>
                {!item.is_read && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', ...SHADOWS.sm,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  badge: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markAllText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.primary, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: SPACING.md },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  emptyText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  list: { padding: SPACING.md, gap: SPACING.sm },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm,
  },
  itemUnread: { backgroundColor: '#FAFBFF', borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text, fontWeight: '500', marginBottom: 2 },
  itemTitleUnread: { fontWeight: TYPOGRAPHY.fontWeightBold },
  itemBody: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, lineHeight: 18 },
  itemTime: { fontSize: 11, color: COLORS.textTertiary, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.primary, marginTop: 6 },
});
