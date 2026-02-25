import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Slide {
  id: string;
  emoji: string;
  title: string;
  titleAr: string;
  subtitle: string;
  bg: string;
  light: boolean;
  isLast?: boolean;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    emoji: '🏪',
    title: 'Welcome to Kaero',
    titleAr: 'أهلاً بك في كايرو',
    subtitle: "Egypt's trusted hyperlocal marketplace. Buy and sell second-hand items safely near you.",
    bg: '#00A651',
    light: true,
  },
  {
    id: '2',
    emoji: '✨',
    title: 'AI-Powered Listings',
    titleAr: 'إعلانات بالذكاء الاصطناعي',
    subtitle: 'Take a photo — our AI fills the title, description and price for you in seconds.',
    bg: '#FFFFFF',
    light: false,
  },
  {
    id: '3',
    emoji: '🔒',
    title: 'Escrow Protection',
    titleAr: 'حماية بنظام الضمان',
    subtitle: 'Your payment is held safely until you confirm you received your item. No scams.',
    bg: '#FFFFFF',
    light: false,
  },
  {
    id: '4',
    emoji: '🚀',
    title: 'Ready to Start?',
    titleAr: 'مستعد للبدء؟',
    subtitle: 'Join thousands of Egyptians buying and selling safely every day.',
    bg: '#00A651',
    light: true,
    isLast: true,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleComplete = async () => {
    await AsyncStorage.setItem('@kaero_onboarding_complete', '1');
    router.replace('/(auth)/login');
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }
  };

  const handleSkip = () => {
    const lastIndex = SLIDES.length - 1;
    flatListRef.current?.scrollToIndex({ index: lastIndex, animated: true });
    setCurrentIndex(lastIndex);
  };

  const onMomentumScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const renderSlide = ({ item }: ListRenderItemInfo<Slide>) => {
    const textColor = item.light ? '#FFFFFF' : COLORS.text;
    const subtitleColor = item.light ? 'rgba(255,255,255,0.85)' : COLORS.textSecondary;

    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH, backgroundColor: item.bg }]}>
        {/* Emoji */}
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{item.emoji}</Text>
        </View>

        {/* Text block */}
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
          <Text style={[styles.titleAr, { color: item.light ? 'rgba(255,255,255,0.9)' : COLORS.textSecondary }]}>
            {item.titleAr}
          </Text>
          <Text style={[styles.subtitle, { color: subtitleColor }]}>{item.subtitle}</Text>
        </View>

        {/* Get Started button — last slide only */}
        {item.isLast && (
          <TouchableOpacity style={styles.getStartedButton} onPress={handleComplete} activeOpacity={0.85}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const currentSlide = SLIDES[currentIndex];
  const isLight = currentSlide?.light ?? false;
  const isLast = currentSlide?.isLast ?? false;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isLight ? 'light-content' : 'dark-content'}
        backgroundColor={currentSlide?.bg ?? COLORS.primary}
        translucent={false}
      />

      {/* Skip button — hidden on last slide */}
      {!isLast && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: isLight ? 'rgba(255,255,255,0.8)' : COLORS.textSecondary }]}>
            Skip
          </Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom bar: dots + Next button */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: currentSlide?.bg ?? COLORS.primary },
        ]}
      >
        {/* Pagination dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: isLight
                    ? i === currentIndex
                      ? '#FFFFFF'
                      : 'rgba(255,255,255,0.35)'
                    : i === currentIndex
                    ? COLORS.primary
                    : COLORS.border,
                  width: i === currentIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Next button — hidden on last slide (Get Started is inside the slide) */}
        {!isLast ? (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
            <Text style={[styles.nextText, { color: isLight ? COLORS.primary : COLORS.surface }]}>
              Next →
            </Text>
          </TouchableOpacity>
        ) : (
          // Spacer so dots stay left-aligned on last slide
          <View style={styles.nextButtonSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Skip
  skipButton: {
    position: 'absolute',
    top: SPACING.huge,
    right: SPACING.xl,
    zIndex: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  skipText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },

  // Slide
  slide: {
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
    paddingBottom: 120, // leave room for bottom bar
  },

  // Emoji
  emojiContainer: {
    marginBottom: SPACING.xxxl,
  },
  emoji: {
    fontSize: 80,
    textAlign: 'center',
  },

  // Text
  textBlock: {
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeDisplay,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    lineHeight: 40,
  },
  titleAr: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: TYPOGRAPHY.lineHeightLG,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: SPACING.md,
  },

  // Get Started (inside last slide)
  getStartedButton: {
    marginTop: SPACING.huge,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.huge,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  getStartedText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dot: {
    height: 8,
    borderRadius: RADIUS.full,
  },

  // Next
  nextButton: {
    backgroundColor: COLORS.text,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  nextText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  nextButtonSpacer: {
    width: 80,
  },
});
