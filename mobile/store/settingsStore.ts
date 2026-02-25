import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from '../constants/translations';

interface SettingsState {
  lang: Lang; isDark: boolean;
  setLang: (lang: Lang) => void;
  toggleDark: () => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  lang: 'en', isDark: false,
  setLang: async (lang) => { set({ lang }); await AsyncStorage.setItem('lang', lang); },
  toggleDark: async () => { const isDark = !get().isDark; set({ isDark }); await AsyncStorage.setItem('isDark', isDark ? '1' : '0'); },
  loadSettings: async () => {
    try {
      const lang = await AsyncStorage.getItem('lang') as Lang | null;
      const isDark = await AsyncStorage.getItem('isDark');
      set({ lang: lang ?? 'en', isDark: isDark === '1' });
    } catch {}
  },
}));
