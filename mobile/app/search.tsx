import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Keyboard, Alert, Modal, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, CONDITION_LABELS } from '../constants/theme';
import { listingService } from '../services/listing.service';
import { categoryService } from '../services/category.service';
import { useLocationStore } from '../store/locationStore';
import { ListingCard } from '../components/listing/ListingCard';
import api from '../services/api';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest',    label: 'Newest' },
  { value: 'price',     label: 'Price ↑' },
  { value: 'distance',  label: 'Nearest' },
] as const;
const RECENT_SEARCHES = ['iPhone 13', 'MacBook Pro', 'PS5', 'AirPods'];

interface Filters {
  condition: string;
  min_price: string;
  max_price: string;
  sort: string;
  category_id: number | null;
}

const DEFAULT_FILTERS: Filters = {
  condition: '', min_price: '', max_price: '', sort: 'relevance', category_id: null,
};

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coords } = useLocationStore();
  const inputRef = useRef<TextInput>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const [query, setQuery]           = useState('');
  const [submitted, setSubmitted]   = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [filters, setFilters]           = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
    staleTime: 1000 * 60 * 10,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['search', submitted, coords, filters],
    queryFn: () => listingService.search(submitted, {
      lat: coords?.lat,
      lng: coords?.lng,
      limit: 30,
      condition: filters.condition || undefined,
      min_price: filters.min_price ? Number(filters.min_price) : undefined,
      max_price: filters.max_price ? Number(filters.max_price) : undefined,
      sort: filters.sort !== 'relevance' ? (filters.sort as any) : undefined,
      category_id: filters.category_id ?? undefined,
    }),
    enabled: submitted.length > 0,
  });

  const listings = data?.listings ?? [];
  const activeFilterCount = [
    filters.condition, filters.min_price, filters.max_price,
    filters.sort !== 'relevance' ? filters.sort : '',
    filters.category_id ? 'cat' : '',
  ].filter(Boolean).length;

  const handleSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
    Keyboard.dismiss();
  };

  const applyFilters = () => {
    setFilters({ ...draftFilters });
    setShowFilters(false);
  };

  const resetFilters = () => {
    setDraftFilters({ ...DEFAULT_FILTERS });
    setFilters({ ...DEFAULT_FILTERS });
  };

  const startVoice = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert('Microphone permission required'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch { Alert.alert('Could not start recording'); }
  };

  const stopVoice = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setTranscribing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;
      const { FileSystem } = await import('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data } = await api.post('/ai/voice-search', { audio_base64: base64, mime_type: 'audio/m4a' });
      if (data.transcript) {
        setQuery(data.transcript);
        handleSearch(data.transcript);
      } else {
        Alert.alert('Could not understand', 'Try speaking clearly or type your search');
      }
    } catch {
      Alert.alert('Voice search failed', 'Please try typing instead');
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <Ionicons name="search" size={18} color="#AAA" />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch(query)}
            placeholder="Search anything..."
            placeholderTextColor="#AAA"
            returnKeyType="search"
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>
        {query ? (
          <TouchableOpacity onPress={() => handleSearch(query)} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        ) : transcribing ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={isRecording ? stopVoice : startVoice}
          >
            <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={22} color={isRecording ? COLORS.error : COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter row — shown once a search is submitted */}
      {submitted.length > 0 && (
        <View style={styles.filterBar}>
          <TouchableOpacity style={styles.filterBtn} onPress={() => { setDraftFilters({ ...filters }); setShowFilters(true); }}>
            <Ionicons name="options-outline" size={16} color={activeFilterCount > 0 ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.filterBtnText, activeFilterCount > 0 && { color: COLORS.primary }]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={resetFilters} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.resultsCount}>{listings.length} results</Text>
        </View>
      )}

      {/* Suggestions */}
      {!submitted && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestTitle}>Recent Searches</Text>
          {RECENT_SEARCHES.map(s => (
            <TouchableOpacity key={s} style={styles.suggestRow} onPress={() => { setQuery(s); handleSearch(s); }}>
              <Ionicons name="time-outline" size={16} color="#AAA" />
              <Text style={styles.suggestText}>{s}</Text>
              <Ionicons name="arrow-up-back" size={14} color="#AAA" />
            </TouchableOpacity>
          ))}
          <Text style={[styles.suggestTitle, { marginTop: SPACING.xl }]}>Browse by Category</Text>
          <View style={styles.tagsRow}>
            {['Phones', 'Laptops', 'Cars', 'Furniture', 'Gaming', 'Audio'].map(tag => (
              <TouchableOpacity key={tag} style={styles.tag} onPress={() => { setQuery(tag); handleSearch(tag); }}>
                <Text style={styles.tagText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Loading */}
      {isLoading && submitted && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Results */}
      {submitted && !isLoading && (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/listing/${item.id}` as any)} activeOpacity={0.9}>
              <ListingCard item={item} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptyText}>Try different keywords or clear filters</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Filter Modal ───────────────────────────────── */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setDraftFilters({ ...DEFAULT_FILTERS })}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {/* Sort */}
            <Text style={styles.filterSectionLabel}>Sort By</Text>
            <View style={styles.chipRow}>
              {SORT_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.chip, draftFilters.sort === o.value && styles.chipActive]}
                  onPress={() => setDraftFilters(d => ({ ...d, sort: o.value }))}
                >
                  <Text style={[styles.chipText, draftFilters.sort === o.value && styles.chipTextActive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Condition */}
            <Text style={styles.filterSectionLabel}>Condition</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !draftFilters.condition && styles.chipActive]}
                onPress={() => setDraftFilters(d => ({ ...d, condition: '' }))}
              >
                <Text style={[styles.chipText, !draftFilters.condition && styles.chipTextActive]}>Any</Text>
              </TouchableOpacity>
              {CONDITIONS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, draftFilters.condition === c && styles.chipActive]}
                  onPress={() => setDraftFilters(d => ({ ...d, condition: c }))}
                >
                  <Text style={[styles.chipText, draftFilters.condition === c && styles.chipTextActive]}>
                    {CONDITION_LABELS[c]?.en ?? c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Price Range */}
            <Text style={styles.filterSectionLabel}>Price Range (EGP)</Text>
            <View style={styles.priceRangeRow}>
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceInputLabel}>Min</Text>
                <TextInput
                  style={styles.priceInput}
                  value={draftFilters.min_price}
                  onChangeText={v => setDraftFilters(d => ({ ...d, min_price: v }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#AAA"
                />
              </View>
              <Text style={styles.priceSep}>—</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceInputLabel}>Max</Text>
                <TextInput
                  style={styles.priceInput}
                  value={draftFilters.max_price}
                  onChangeText={v => setDraftFilters(d => ({ ...d, max_price: v }))}
                  keyboardType="numeric"
                  placeholder="Any"
                  placeholderTextColor="#AAA"
                />
              </View>
            </View>

            {/* Quick price chips */}
            <View style={styles.chipRow}>
              {[['Under 500', '', '500'], ['500–2k', '500', '2000'], ['2k–10k', '2000', '10000'], ['Over 10k', '10000', '']].map(([label, min, max]) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.chip, draftFilters.min_price === min && draftFilters.max_price === max && styles.chipActive]}
                  onPress={() => setDraftFilters(d => ({ ...d, min_price: min, max_price: max }))}
                >
                  <Text style={[styles.chipText, draftFilters.min_price === min && draftFilters.max_price === max && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category */}
            <Text style={styles.filterSectionLabel}>Category</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !draftFilters.category_id && styles.chipActive]}
                onPress={() => setDraftFilters(d => ({ ...d, category_id: null }))}
              >
                <Text style={[styles.chipText, !draftFilters.category_id && styles.chipTextActive]}>All</Text>
              </TouchableOpacity>
              {(categories ?? []).map((cat: any) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, draftFilters.category_id === cat.id && styles.chipActive]}
                  onPress={() => setDraftFilters(d => ({ ...d, category_id: cat.id }))}
                >
                  <Text style={[styles.chipText, draftFilters.category_id === cat.id && styles.chipTextActive]}>
                    {cat.name_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Apply button */}
          <View style={[styles.applyWrap, { paddingBottom: insets.bottom + SPACING.md }]}>
            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Show Results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  inputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#F5F5F5', borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 44,
  },
  input: { flex: 1, fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  searchBtn: { paddingHorizontal: SPACING.sm },
  searchBtnText: { color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeightBold },
  micBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: '#FFE5E5' },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: '#FAFAFA',
  },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  filterBtnText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, fontWeight: '600' },
  clearBtn: { paddingHorizontal: SPACING.sm },
  clearBtnText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.error },
  resultsCount: { marginLeft: 'auto', fontSize: 12, color: COLORS.textTertiary },
  suggestions: { padding: SPACING.lg },
  suggestTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  suggestText: { flex: 1, fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tag: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F5F5F5' },
  tagText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary },
  listContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },
  row: { justifyContent: 'space-between', gap: SPACING.md },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  emptyText: { color: COLORS.textSecondary, marginTop: 4 },
  // Filter modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  resetText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.error },
  modalScroll: { flex: 1 },
  modalContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 20 },
  filterSectionLabel: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  priceRangeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.sm },
  priceInputWrap: { flex: 1, gap: 4 },
  priceInputLabel: { fontSize: 11, color: COLORS.textTertiary, textTransform: 'uppercase' },
  priceInput: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  priceSep: { fontSize: TYPOGRAPHY.fontSizeLG, color: COLORS.textTertiary, marginTop: 16 },
  applyWrap: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  applyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: SPACING.md + 2, alignItems: 'center', ...SHADOWS.md },
  applyBtnText: { color: '#fff', fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold },
});
