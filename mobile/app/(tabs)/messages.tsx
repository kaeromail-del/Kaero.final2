import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { chatService } from '../../services/chat.service';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/ui/Avatar';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const { data: chats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['chats'],
    queryFn: () => chatService.getChats(),
    refetchInterval: 10000, // Poll every 10s
  });

  const totalUnread = chats?.reduce((sum: number, c: any) => sum + (parseInt(c.unread_count) || 0), 0) ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        {totalUnread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item: any) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          renderItem={({ item }: { item: any }) => {
            const unread = parseInt(item.unread_count) || 0;
            const isLastMine = item.last_message_sender_id === user?.id;
            return (
              <TouchableOpacity
                style={styles.chatItem}
                onPress={() => router.push(`/chat/${item.id}`)}
                activeOpacity={0.85}
              >
                <View style={styles.avatarContainer}>
                  <Avatar
                    name={item.other_user_name}
                    uri={item.other_user_avatar}
                    size={52}
                    color={COLORS.primary}
                  />
                  {unread > 0 && (
                    <View style={styles.dot} />
                  )}
                </View>

                <View style={styles.chatInfo}>
                  <View style={styles.chatTop}>
                    <Text style={[styles.chatName, unread > 0 && styles.chatNameBold]} numberOfLines={1}>
                      {item.other_user_name || 'User'}
                    </Text>
                    <Text style={styles.chatTime}>{item.last_message_at ? timeAgo(item.last_message_at) : ''}</Text>
                  </View>
                  <Text style={styles.listingTitle} numberOfLines={1}>
                    <Ionicons name="pricetag-outline" size={11} color={COLORS.iconDefault} /> {item.listing_title}
                  </Text>
                  <View style={styles.chatBottom}>
                    <Text style={[styles.lastMsg, unread > 0 && styles.lastMsgBold]} numberOfLines={1}>
                      {isLastMine ? 'You: ' : ''}
                      {item.last_message_type === 'image' ? '📷 Photo' :
                        item.last_message_type === 'voice' ? '🎤 Voice message' :
                          item.last_message || 'Start a conversation'}
                    </Text>
                    {unread > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>Browse listings and start a conversation</Text>
              <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)')}>
                <Text style={styles.browseBtnText}>Browse Market</Text>
              </TouchableOpacity>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={chats?.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cardBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.separator,
  },
  title: { fontSize: TYPOGRAPHY.fontSizeXXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  unreadBadge: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatItem: {
    flexDirection: 'row', padding: SPACING.lg, gap: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.separator,
  },
  avatarContainer: { position: 'relative' },
  dot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.cardBg },
  chatInfo: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  chatName: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  chatNameBold: { fontWeight: TYPOGRAPHY.fontWeightBold },
  chatTime: { fontSize: 12, color: COLORS.textTertiary },
  listingTitle: { fontSize: 12, color: COLORS.textTertiary, marginBottom: 3 },
  chatBottom: { flexDirection: 'row', alignItems: 'center' },
  lastMsg: { flex: 1, fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, lineHeight: 18 },
  lastMsgBold: { fontWeight: TYPOGRAPHY.fontWeightMedium, color: COLORS.text },
  badge: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  emptyText: { color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.xl, textAlign: 'center' },
  browseBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  browseBtnText: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },
});
