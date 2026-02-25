import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Image, Alert, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation, useQuery } from '@tanstack/react-query';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, CONDITION_LABELS, SHADOWS } from '../../constants/theme';
import { listingService } from '../../services/listing.service';
import { categoryService } from '../../services/category.service';
import { aiService } from '../../services/ai.service';
import { uploadService } from '../../services/upload.service';
import { useLocationStore } from '../../store/locationStore';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

export default function SellScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coords } = useLocationStore();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>('good');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [aiData, setAiData] = useState<any>(null);
  const [priceSuggestion, setPriceSuggestion] = useState<any>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoryService.getAll() });

  const createMutation = useMutation({
    mutationFn: (data: any) => listingService.create(data),
    onSuccess: (listing) => {
      Alert.alert('Posted!', 'Your listing is now live.', [
        { text: 'View Listing', onPress: () => router.push(`/listing/${listing.id}`) },
        { text: 'Sell Another', onPress: () => { resetForm(); router.replace('/(tabs)/sell'); } },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Failed to post listing'),
  });

  const resetForm = () => {
    setPhotos([]); setTitle(''); setDescription(''); setPrice('');
    setCondition('good'); setCategoryId(null); setAiData(null); setPriceSuggestion(null);
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) { Alert.alert('Camera permission required'); return; }
    }
    setShowCamera(true);
  };

  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.8 });
      if (photo?.uri) {
        setPhotos(p => [...p, photo.uri]);
        setShowCamera(false);
        // Auto-analyze first photo
        if (photos.length === 0 && photo.base64) {
          analyzePhoto(photo.base64);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const analyzePhoto = async (base64: string) => {
    setAnalyzing(true);
    try {
      const result = await aiService.analyzeImage(base64);
      setAiData(result);
      if (result.title && !title) setTitle(result.title);
      if (result.description && !description) setDescription(result.description);
      if (result.suggested_price && !price) setPrice(String(result.suggested_price));
      if (result.condition) setCondition(result.condition);
      if (result.category_id && !categoryId) setCategoryId(result.category_id);
    } catch {
      // Silently fail AI analysis
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchMarketPrice = async () => {
    if (!title.trim() || title.trim().length < 4) return;
    setFetchingPrice(true);
    try {
      const result = await aiService.suggestPrice(title.trim(), condition, categoryId ?? undefined);
      setPriceSuggestion(result);
      // Auto-fill only if user hasn't typed a price yet
      if (result.suggested_price && !price) setPrice(String(result.suggested_price));
    } catch {
      // Silently fail
    } finally {
      setFetchingPrice(false);
    }
  };

  const handlePost = async () => {
    if (!title.trim()) { Alert.alert('Missing title'); return; }
    if (!price || isNaN(Number(price))) { Alert.alert('Enter a valid price'); return; }
    if (photos.length === 0) { Alert.alert('Add at least one photo'); return; }
    if (!coords) { Alert.alert('Location required', 'Enable location to post listings'); return; }

    try {
      setUploading(true);
      // Upload all local photos to server, get hosted URLs
      const hostedUrls = await uploadService.uploadImages(photos);
      setUploading(false);

      createMutation.mutate({
        user_edited_title: title.trim(),
        user_edited_description: description.trim(),
        final_price: Number(price),
        condition,
        category_id: categoryId ?? undefined,
        lat: coords!.lat,
        lng: coords!.lng,
        primary_image_url: hostedUrls[0],
        additional_images: hostedUrls.slice(1),
        verification_images: hostedUrls.map((url, i) => ({
          url, timestamp: new Date().toISOString(), exif_data: null, hash: `${i}_${Date.now()}`,
        })),
        is_ai_generated: !!aiData,
        ai_generated_title: aiData?.title,
        ai_generated_description: aiData?.description,
        ai_suggested_price: aiData?.suggested_price,
      });
    } catch {
      setUploading(false);
      Alert.alert('Upload failed', 'Could not upload photos. Please try again.');
    }
  };

  const selectedCategory = categories?.find((c: any) => c.id === categoryId);

  // Camera modal
  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        <View style={styles.cameraControls}>
          <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.camBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={capturePhoto} style={styles.captureBtn} />
          <View style={styles.camBtn} />
        </View>
        <Text style={styles.cameraHint}>Photos are taken in-app only • No gallery access</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sell an Item</Text>
          <Text style={styles.headerSub}>60-second listing with AI</Text>
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoImg} />
                {i === 0 && <View style={styles.primaryBadge}><Text style={styles.primaryText}>Main</Text></View>}
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={takePhoto}>
                <Ionicons name="camera" size={28} color={COLORS.primary} />
                <Text style={styles.addPhotoText}>{photos.length === 0 ? 'Take Photo' : 'Add More'}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          {analyzing && (
            <View style={styles.analyzingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.analyzingText}>AI analyzing your photo...</Text>
            </View>
          )}
          {aiData && !analyzing && (
            <View style={styles.aiSuccessBanner}>
              <Ionicons name="sparkles" size={14} color={COLORS.primary} />
              <Text style={styles.aiSuccessText}>AI filled in details for you! Review and edit below.</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What are you selling?"
            maxLength={80}
            placeholderTextColor="#AAA"
          />
          <Text style={styles.charCount}>{title.length}/80</Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe condition, specs, reason for selling..."
            multiline
            numberOfLines={4}
            maxLength={1000}
            placeholderTextColor="#AAA"
            textAlignVertical="top"
          />
        </View>

        {/* Price */}
        <View style={styles.section}>
          <View style={styles.priceLabelRow}>
            <Text style={styles.sectionLabel}>Price (EGP) *</Text>
            {title.trim().length >= 4 && (
              <TouchableOpacity
                style={styles.marketPriceBtn}
                onPress={fetchMarketPrice}
                disabled={fetchingPrice}
              >
                {fetchingPrice
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <><Ionicons name="bar-chart-outline" size={13} color={COLORS.primary} /><Text style={styles.marketPriceBtnText}>Market Price</Text></>
                }
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.priceRow}>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={price}
              onChangeText={v => { setPrice(v); setPriceSuggestion(null); }}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor="#AAA"
            />
            <Text style={styles.currency}>EGP</Text>
          </View>

          {/* Market price hint card */}
          {priceSuggestion?.suggested_price && (
            <View style={styles.priceHintCard}>
              <View style={styles.priceHintHeader}>
                <Ionicons name="trending-up" size={14} color={COLORS.primary} />
                <Text style={styles.priceHintTitle}>Market data ({priceSuggestion.sample_size} similar listings)</Text>
              </View>
              <View style={styles.priceHintRow}>
                <View style={styles.priceHintStat}>
                  <Text style={styles.priceHintVal}>{priceSuggestion.suggested_price} EGP</Text>
                  <Text style={styles.priceHintLbl}>Suggested</Text>
                </View>
                <View style={styles.priceHintStat}>
                  <Text style={styles.priceHintVal}>{priceSuggestion.min_price}–{priceSuggestion.max_price}</Text>
                  <Text style={styles.priceHintLbl}>Range</Text>
                </View>
                <TouchableOpacity
                  style={styles.useHintBtn}
                  onPress={() => setPrice(String(priceSuggestion.suggested_price))}
                >
                  <Text style={styles.useHintBtnText}>Use</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {aiData?.suggested_price && !priceSuggestion && (
            <TouchableOpacity onPress={() => setPrice(String(aiData.suggested_price))}>
              <Text style={styles.suggestedPrice}>AI suggests: {aiData.suggested_price} EGP (tap to use)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Condition */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Condition *</Text>
          <View style={styles.conditionRow}>
            {CONDITIONS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.conditionBtn, condition === c && styles.conditionActive]}
                onPress={() => setCondition(c)}
              >
                <Text style={[styles.conditionText, condition === c && styles.conditionTextActive]}>
                  {CONDITION_LABELS[c]?.en ?? c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCatModal(true)}>
            <Text style={selectedCategory ? styles.selectValue : styles.selectPlaceholder}>
              {selectedCategory ? selectedCategory.name_en : 'Select a category'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#AAA" />
          </TouchableOpacity>
        </View>

        {/* Post button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.postBtn, (uploading || createMutation.isPending) && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={uploading || createMutation.isPending}
          >
            {uploading
              ? <><ActivityIndicator color="#fff" /><Text style={styles.postBtnText}>Uploading photos...</Text></>
              : createMutation.isPending
                ? <><ActivityIndicator color="#fff" /><Text style={styles.postBtnText}>Posting...</Text></>
                : <><Ionicons name="cloud-upload" size={20} color="#fff" /><Text style={styles.postBtnText}>Post Listing</Text></>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Category Modal */}
      <Modal visible={showCatModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setShowCatModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={({ item }: any) => (
              <TouchableOpacity
                style={[styles.catItem, categoryId === item.id && styles.catItemActive]}
                onPress={() => { setCategoryId(item.id); setShowCatModal(false); }}
              >
                <Text style={styles.catItemText}>{item.name_en}</Text>
                {categoryId === item.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#fff', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg, ...SHADOWS.sm },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  headerSub: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, marginTop: 2 },
  section: { backgroundColor: '#fff', padding: SPACING.lg, marginTop: SPACING.sm },
  sectionLabel: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.textSecondary, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  photosRow: { gap: SPACING.sm },
  photoThumb: { width: 100, height: 100, borderRadius: RADIUS.md, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  primaryBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 2 },
  primaryText: { color: '#fff', textAlign: 'center', fontSize: 10, fontWeight: '600' },
  removePhoto: { position: 'absolute', top: 4, right: 4 },
  addPhotoBtn: {
    width: 100, height: 100, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.primaryLight,
  },
  addPhotoText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  analyzingText: { color: COLORS.primary, fontSize: TYPOGRAPHY.fontSizeSM },
  aiSuccessBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm,
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, padding: SPACING.sm,
  },
  aiSuccessText: { color: COLORS.primary, fontSize: TYPOGRAPHY.fontSizeSM, flex: 1 },
  input: {
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, height: 50,
    fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text,
  },
  textArea: { height: 100, paddingTop: SPACING.md },
  charCount: { textAlign: 'right', fontSize: 11, color: '#AAA', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  priceInput: { flex: 1 },
  currency: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.textSecondary },
  suggestedPrice: { color: COLORS.primary, fontSize: TYPOGRAPHY.fontSizeSM, marginTop: 4 },
  priceLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  marketPriceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  marketPriceBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  priceHintCard: { marginTop: SPACING.sm, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.primary + '30' },
  priceHintHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
  priceHintTitle: { fontSize: 12, color: COLORS.primaryDark, fontWeight: '600' },
  priceHintRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  priceHintStat: { flex: 1 },
  priceHintVal: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.text },
  priceHintLbl: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  useHintBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  useHintBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  conditionBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: '#DDD',
  },
  conditionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  conditionText: { fontSize: TYPOGRAPHY.fontSizeSM, color: '#555', fontWeight: TYPOGRAPHY.fontWeightMedium },
  conditionTextActive: { color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeightBold },
  selectBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, height: 50,
  },
  selectValue: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
  selectPlaceholder: { fontSize: TYPOGRAPHY.fontSizeMD, color: '#AAA' },
  footer: { padding: SPACING.lg, paddingBottom: 100 },
  postBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { color: '#fff', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold },
  // Camera
  cameraControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xxl },
  camBtn: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)' },
  cameraHint: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, paddingBottom: SPACING.lg },
  // Modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold },
  catItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  catItemActive: { backgroundColor: COLORS.primaryLight },
  catItemText: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.text },
});
