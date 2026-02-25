import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

// Configure notification handler (how notifications appear in foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  /** Register device for Expo push notifications, store token on backend */
  async registerPushToken(): Promise<void> {
    if (!Device.isDevice) return; // Doesn't work on simulator
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Send to backend
    try {
      await api.post('/notifications/push-token', { token });
    } catch {
      // Non-fatal
    }
  },

  /** Fetch in-app notifications from backend */
  async getNotifications() {
    const { data } = await api.get('/notifications');
    return data as { notifications: any[]; unread_count: number };
  },

  /** Mark all notifications as read */
  async markAllRead() {
    await api.patch('/notifications/read-all');
  },

  /** Mark one notification as read */
  async markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
  },
};
