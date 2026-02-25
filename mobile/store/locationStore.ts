import { create } from 'zustand';
import * as Location from 'expo-location';

interface LocationState {
  coords: { lat: number; lng: number } | null;
  address: string | null;
  permissionGranted: boolean;
  isLoading: boolean;
  requestLocation: () => Promise<void>;
}

export const useLocationStore = create<LocationState>((set) => ({
  coords: null, address: null, permissionGranted: false, isLoading: false,

  requestLocation: async () => {
    set({ isLoading: true });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ permissionGranted: false, coords: { lat: 30.0444, lng: 31.2357 }, isLoading: false });
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: location.coords.latitude, lng: location.coords.longitude };
      set({ coords, permissionGranted: true });
      try {
        const [addr] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
        set({ address: [addr.district, addr.city].filter(Boolean).join(', '), isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    } catch {
      set({ coords: { lat: 30.0444, lng: 31.2357 }, isLoading: false });
    }
  },
}));
