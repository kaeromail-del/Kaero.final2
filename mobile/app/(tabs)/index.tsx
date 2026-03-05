import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Platform,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { listingService } from '../../services/listing.service';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import { aiService } from '../../services/ai.service';

const CAIRO = { lat: 30.0444, lng: 31.2357 };

const RADIUS_PRESETS = [
  { label: '300m', value: 300 },
  { label: '500m', value: 500 },
  { label: '1km',  value: 1000 },
  { label: '3km',  value: 3000 },
  { label: '10km', value: 10000 },
];

function formatRadius(r: number) {
  return r >= 1000 ? `${r / 1000}km` : `${r}m`;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const d = 2 * R * Math.asin(Math.sqrt(a));
  return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { coords, address, requestLocation } = useLocationStore();
  const effectiveCoords = coords ?? CAIRO;
  const recordingRef = useRef<Audio.Recording | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [searchRadius, setSearchRadius] = useState(1000);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  React.useEffect(() => { if (!coords) requestLocation(); }, []);

  const { data: searchData, isLoading } = useQuery({
    queryKey: ['explore', activeQuery, searchRadius, effectiveCoords.lat, effectiveCoords.lng],
    queryFn: () => listingService.search(activeQuery, {
      lat: effectiveCoords.lat,
      lng: effectiveCoords.lng,
      radius: searchRadius,
      limit: 50,
    }),
    enabled: !!activeQuery,
    staleTime: 1000 * 30,
  });

  const listings: any[] = searchData?.listings ?? [];

  const doSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setActiveQuery(trimmed);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      const recording = recordingRef.current;
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) return;
      setTranscribing(true);
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4';
        const { transcript } = await aiService.transcribeVoice(base64, mimeType);
        if (transcript) {
          setSearchQuery(transcript);
          doSearch(transcript);
        }
      } catch { /* silent */ }
      finally { setTranscribing(false); }
    } else {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const delta = Math.max((searchRadius / 111000) * 3, 0.005);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋</Text>
            {address && (
              <TouchableOpacity style={styles.locationRow} onPress={requestLocation}>
                <Ionicons name="location" size={12} color={COLORS.primary} />
                <Text style={styles.locationText} numberOfLines={1}>{address}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.iconDefault} />
          </TouchableOpacity>
        </View>

        {/* Search + mic */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.iconDefault} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="What are you looking for?"
            placeholderTextColor={COLORS.iconDefault}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setActiveQuery(''); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.iconDefault} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnRecording]}
            onPress={toggleRecording}
            disabled={transcribing}
          >
            {transcribing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name={isRecording ? 'stop' : 'mic'} size={15} color="#fff" />
            }
          </TouchableOpacity>
        </View>

        {/* Radius selector */}
        <View style={styles.radiusRow}>
          <Ionicons name="radio-outline" size={13} color={COLORS.textSecondary} />
          {RADIUS_PRESETS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.radiusChip, searchRadius === p.value && styles.radiusChipActive]}
              onPress={() => setSearchRadius(p.value)}
            >
              <Text style={[styles.radiusChipText, searchRadius === p.value && styles.radiusChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Map + Overlays ───────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        <MapView
          style={StyleSheet.absoluteFill}
          region={{
            latitude: effectiveCoords.lat,
            longitude: effectiveCoords.lng,
            latitudeDelta: delta,
            longitudeDelta: delta,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Radius circle */}
          <Circle
            center={{ latitude: effectiveCoords.lat, longitude: effectiveCoords.lng }}
            radius={searchRadius}
            fillColor="rgba(0,166,81,0.07)"
            strokeColor="rgba(0,166,81,0.4)"
            strokeWidth={1.5}
          />

          {/* Only searched items appear as markers */}
          {listings.map((item: any) => {
            const lat = Number(item.lat ?? item.location_lat);
            const lng = Number(item.lng ?? item.location_lng);
            if (!lat || !lng) return null;
            return (
              <Marker
                key={item.id}
                coordinate={{ latitude: lat, longitude: lng }}
                onPress={() => { aiService.trackView(item.id); router.push(`/listing/${item.id}`); }}
              >
                <View style={styles.priceBubble}>
                  <Text style={styles.priceBubbleText}>
                    {Number(item.final_price) >= 1000
                      ? `${Math.round(Number(item.final_price) / 1000)}k`
                      : Number(item.final_price)} EGP
                  </Text>
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Loading pill */}
        {isLoading && (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Searching within {formatRadius(searchRadius)}...</Text>
          </View>
        )}

        {/* Recording badge */}
        {isRecording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Listening... tap stop when done</Text>
          </View>
        )}

        {/* No search yet */}
        {!activeQuery && !isLoading && !isRecording && !transcribing && (
          <View style={styles.centeredOverlay} pointerEvents="none">
            <View style={styles.hintCard}>
              <Ionicons name="mic" size={28} color={COLORS.primary} />
              <Text style={styles.hintTitle}>Tap the mic to search</Text>
              <Text style={styles.hintSub}>Say what you're looking for — we'll find it on the radar near you</Text>
            </View>
          </View>
        )}

        {/* No results */}
        {activeQuery && !isLoading && listings.length === 0 && (
          <View style={styles.centeredOverlay} pointerEvents="none">
            <View style={styles.hintCard}>
              <Text style={{ fontSize: 28 }}>🔍</Text>
              <Text style={styles.hintTitle}>Nothing found nearby</Text>
              <Text style={styles.hintSub}>No "{activeQuery}" within {formatRadius(searchRadius)}. Try a larger radius.</Text>
            </View>
          </View>
        )}

        {/* My location button */}
        <TouchableOpacity style={styles.myLocationBtn} onPress={requestLocation}>
          <Ionicons name="locate" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        {/* ── Bottom results strip ─────────────────────────── */}
        {listings.length > 0 && !isLoading && (
          <View style={styles.bottomStrip}>
            <View style={styles.bottomStripHeader}>
              <Text style={styles.bottomStripCount}>
                {listings.length} result{listings.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.bottomStripMeta}>"{activeQuery}" · {formatRadius(searchRadius)}</Text>
            </View>
            <FlatList
              data={listings}
              keyExtractor={(item: any) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bottomList}
              renderItem={({ item }: any) => {
                const lat = Number(item.lat ?? item.location_lat);
                const lng = Number(item.lng ?? item.location_lng);
                const dist = lat && lng ? haversineDistance(effectiveCoords.lat, effectiveCoords.lng, lat, lng) : null;
                return (
                  <TouchableOpacity
                    style={styles.resultCard}
                    onPress={() => { aiService.trackView(item.id); router.push(`/listing/${item.id}`); }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.resultTitle} numberOfLines={2}>{item.user_edited_title}</Text>
                    <Text style={styles.resultPrice}>EGP {Number(item.final_price).toLocaleString()}</Text>
                    {dist && (
                      <View style={styles.resultDistRow}>
                        <Ionicons name="location" size={10} color={COLORS.primary} />
                        <Text style={styles.resultDist}>{dist} away</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.xs, marginBottom: SPACING.sm },
  greeting: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { fontSize: TYPOGRAPHY.fontSizeXS, color: COLORS.textSecondary, maxWidth: 200 },
  headerIconBtn: { width: 38, height: 38, borderRadius: RADIUS.full, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, height: 44,
    borderWidth: 1, borderColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.text, paddingVertical: 0 },
  micBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnRecording: { backgroundColor: '#E53E3E' },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: SPACING.xs },
  radiusChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardBg,
  },
  radiusChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radiusChipText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: TYPOGRAPHY.fontWeightMedium },
  radiusChipTextActive: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightSemiBold },
  loadingPill: {
    position: 'absolute', top: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 8,
    ...SHADOWS.sm,
  },
  loadingText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary },
  recordingBadge: {
    position: 'absolute', top: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E53E3E', borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  recordingText: { fontSize: TYPOGRAPHY.fontSizeSM, color: '#fff', fontWeight: TYPOGRAPHY.fontWeightSemiBold },
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  hintCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16, padding: 24,
    alignItems: 'center', maxWidth: 260, gap: 8,
    ...SHADOWS.md,
  },
  hintTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text, textAlign: 'center' },
  hintSub: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  myLocationBtn: {
    position: 'absolute', bottom: 160, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.md,
  },
  priceBubble: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 2, borderColor: '#fff',
    ...SHADOWS.sm,
  },
  priceBubbleText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bottomStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: SPACING.md, paddingBottom: SPACING.xl,
    ...SHADOWS.lg,
  },
  bottomStripHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm,
  },
  bottomStripCount: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  bottomStripMeta: { fontSize: TYPOGRAPHY.fontSizeXS, color: COLORS.textSecondary },
  bottomList: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  resultCard: {
    width: 140, backgroundColor: COLORS.background,
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  resultTitle: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.text, lineHeight: 18 },
  resultPrice: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.primary, marginTop: 4 },
  resultDistRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  resultDist: { fontSize: 10, color: COLORS.textSecondary },
});
