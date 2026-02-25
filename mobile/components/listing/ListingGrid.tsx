import React from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text, RefreshControl } from 'react-native';
import { ListingCard } from './ListingCard';
import { SkeletonRow, SkeletonCard } from '../ui/SkeletonCard';
import { COLORS, SPACING } from '../../constants/theme';

const SKELETON_COUNT = 6;

interface ListingGridProps {
  listings: any[]; loading?: boolean; refreshing?: boolean;
  onRefresh?: () => void; onEndReached?: () => void;
  emptyText?: string; compact?: boolean;
}

export function ListingGrid({ listings, loading, refreshing, onRefresh, onEndReached, emptyText = 'No listings found', compact }: ListingGridProps) {
  if (loading && !listings.length) {
    if (compact) {
      return (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <SkeletonCard key={i} compact />
          ))}
        </View>
      );
    }
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: Math.ceil(SKELETON_COUNT / 2) }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={listings} keyExtractor={(item) => item.id}
      numColumns={compact ? 1 : 2} key={compact ? 'compact' : 'grid'}
      columnWrapperStyle={compact ? undefined : styles.row}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => <ListingCard item={item} compact={compact} />}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} /> : undefined}
      onEndReached={onEndReached} onEndReachedThreshold={0.3}
      ListFooterComponent={loading && listings.length > 0 ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} /> : null}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 100 },
  row: { justifyContent: 'space-between', gap: SPACING.md },
  empty: { textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16 },
  skeletonContainer: { padding: SPACING.lg, gap: SPACING.md },
});
