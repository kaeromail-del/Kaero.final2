import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, isLoading, isAuthenticated, loadUser, logout, setUser, updateUser } = useAuthStore();
  useEffect(() => { loadUser(); }, []);
  return { user, isLoading, isAuthenticated, logout, setUser, updateUser };
}
