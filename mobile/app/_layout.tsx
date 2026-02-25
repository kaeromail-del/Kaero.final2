import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../services/notification.service';
import { COLORS } from '../constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 2 },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  const { isDark, loadSettings } = useSettingsStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    if (isAuthenticated) {
      notificationService.registerPushToken().catch(() => {});
    }
  }, [isAuthenticated]);

  const bg = isDark ? COLORS.darkBackground : COLORS.background;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={bg} />
          <View style={{ flex: 1, backgroundColor: bg }}>
            <Stack screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: bg },
            }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="listing/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="offer/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="payment/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="search" options={{ presentation: 'card' }} />
              <Stack.Screen name="review/[transactionId]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
              <Stack.Screen name="seller/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="favorites" options={{ presentation: 'card' }} />
              <Stack.Screen name="listing/edit/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="listing/offers/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="offers" options={{ presentation: 'card' }} />
              <Stack.Screen name="transaction/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="dispute/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="verify-id" options={{ presentation: 'card' }} />
              <Stack.Screen name="transactions" options={{ presentation: 'card' }} />
              <Stack.Screen name="referral" options={{ presentation: 'card' }} />
              <Stack.Screen name="wallet" options={{ presentation: 'card' }} />
              <Stack.Screen name="ai-assistant" options={{ presentation: 'card' }} />
              <Stack.Screen name="onboarding" options={{ presentation: 'card', gestureEnabled: false }} />
              <Stack.Screen name="privacy-policy" options={{ presentation: 'card' }} />
              <Stack.Screen name="terms" options={{ presentation: 'card' }} />
            </Stack>
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
