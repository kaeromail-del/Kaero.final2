import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../constants/theme';

export default function Index() {
  const router = useRouter();
  const { loadUser } = useAuthStore();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for the navigator to be fully mounted before navigating
    if (!rootNavigationState?.key) return;

    const bootstrap = async () => {
      const onboardingComplete = await AsyncStorage.getItem('@kaero_onboarding_complete');

      if (!onboardingComplete) {
        router.replace('/onboarding');
        return;
      }

      await loadUser();
      const { isAuthenticated } = useAuthStore.getState();
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    };

    bootstrap();
  }, [rootNavigationState?.key]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
