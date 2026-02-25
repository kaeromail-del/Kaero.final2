import { useEffect } from 'react';
import { useLocationStore } from '../store/locationStore';

export function useLocation(autoRequest = false) {
  const { coords, address, permissionGranted, isLoading, requestLocation } = useLocationStore();
  useEffect(() => { if (autoRequest && !coords) requestLocation(); }, [autoRequest]);
  return { coords, address, permissionGranted, isLoading, requestLocation };
}
