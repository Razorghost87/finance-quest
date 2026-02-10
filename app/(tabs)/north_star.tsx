/**
 * North Star Tab — V2 Blueprint with Radial Constellation
 * 
 * The central navigation point of the app.
 * Shows radial constellation with force nodes when data exists.
 * 
 * Features:
 * - Centered North Star (never clipped)
 * - 4 fixed force nodes at dynamic radial positions
 * - Screen-size adaptive positioning
 * - Tap interactions with insight panel
 */

import { ThemedText } from '@/components/themed-text';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { RadialConstellation } from '@/components/ui/RadialConstellation';
import { Colors } from '@/constants/theme';
import { useUserTier } from '@/hooks/use-user-tier';
import {
  calculateDirection,
  DirectionResult,
  DirectionStatus,
} from '@/lib/direction-engine';
import { northHaptics } from '@/lib/haptics';
import {
  ForceNodeData,
  generateForceNodes,
} from '@/lib/radial-layout';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NorthStarState {
  direction: DirectionResult | null;
  nodes: ForceNodeData[];
  hasData: boolean;
  isLoading: boolean;
}

export default function NorthStarScreen() {
  const tier = useUserTier();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<NorthStarState>({
    direction: null,
    nodes: [],
    hasData: false,
    isLoading: true,
  });

  useFocusEffect(
    useCallback(() => {
      fetchDirectionData();
    }, [])
  );

  const fetchDirectionData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const supabase = ensureSupabaseConfigured();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState({ direction: null, nodes: [], hasData: false, isLoading: false });
        return;
      }

      // Fetch the latest extract
      const { data: extract } = await supabase
        .from('statement_extract')
        .select('free_summary')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!extract?.free_summary) {
        setState({ direction: null, nodes: [], hasData: false, isLoading: false });
        return;
      }

      const summary = extract.free_summary;

      // Extract totals
      const totals = summary.totals ? {
        inflow: summary.totals.inflow || 0,
        outflow: summary.totals.outflow || 0,
        netCashflow: summary.totals.netCashflow || 0,
      } : { inflow: 0, outflow: 0, netCashflow: 0 };

      // Extract categories if available
      const categories = summary.categories?.map((cat: { name: string; total: number }) => ({
        name: cat.name,
        amount: cat.total,
        percentage: totals.outflow > 0 ? (cat.total / totals.outflow) * 100 : 0,
      })) || [];

      // Backend confidence if available
      const backendConfidence = summary.confidence?.score;

      // Calculate direction
      const direction = calculateDirection(totals, categories, backendConfidence);

      // Generate force nodes for radial constellation
      const nodes = generateForceNodes(totals);

      setState({
        direction,
        nodes,
        hasData: true,
        isLoading: false,
      });

    } catch (e) {
      console.error("Failed to fetch direction data", e);
      setState({ direction: null, nodes: [], hasData: false, isLoading: false });
    }
  };

  const handleUpload = useCallback(() => {
    northHaptics.medium();
    router.push('/(tabs)/upload');
  }, []);

  // Calculate constellation height (screen height minus safe areas and footer)
  const constellationHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 160;

  return (
    <AuroraBackground tier={tier}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.header}
        >
          <ThemedText style={styles.headerTitle}>Your Direction</ThemedText>
          {state.direction && (
            <ThemedText style={[
              styles.statusBadge,
              { color: getStatusColor(state.direction.status) }
            ]}>
              {getStatusLabel(state.direction.status)}
            </ThemedText>
          )}
        </Animated.View>

        {/* Main Content */}
        {state.isLoading ? (
          <LoadingState />
        ) : state.hasData && state.direction && state.nodes.length > 0 ? (
          <Animated.View
            entering={FadeIn.delay(200).duration(500)}
            style={styles.constellationWrapper}
          >
            <RadialConstellation
              nodes={state.nodes}
              direction={state.direction.status}
              confidence={state.direction.confidence}
              containerHeight={constellationHeight}
            />
          </Animated.View>
        ) : (
          <EmptyState onUpload={handleUpload} />
        )}
      </View>

      {/* Upload CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 24 }]}>
        <CTAButton
          label="Update my direction"
          onPress={handleUpload}
        />
      </View>
    </AuroraBackground>
  );
}

function getStatusColor(status: DirectionStatus): string {
  switch (status) {
    case 'on-course': return Colors.aurora.green;
    case 'drifting': return '#FFC107';
    case 'off-course': return '#FF4D4D';
  }
}

function getStatusLabel(status: DirectionStatus): string {
  switch (status) {
    case 'on-course': return '● On Course';
    case 'drifting': return '● Drifting';
    case 'off-course': return '● Off Course';
  }
}

function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingIcon}>
        <ThemedText style={styles.loadingEmoji}>✦</ThemedText>
      </View>
      <ThemedText style={styles.loadingText}>Loading constellation...</ThemedText>
    </View>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={styles.emptyContainer}
    >
      <View style={styles.emptyIcon}>
        <ThemedText style={styles.emptyIconText}>✦</ThemedText>
      </View>
      <ThemedText style={styles.emptyTitle}>
        Find your direction
      </ThemedText>
      <ThemedText style={styles.emptySubtext}>
        Upload a bank statement to see the forces affecting your financial direction.
      </ThemedText>
      <Pressable
        style={styles.emptyButton}
        onPress={onUpload}
      >
        <ThemedText style={styles.emptyButtonText}>Upload statement</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

function CTAButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
    northHaptics.light();
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.ctaButton}
      >
        <ThemedText style={styles.ctaText}>{label}</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.aurora.text,
    marginBottom: 4,
  },
  statusBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  constellationWrapper: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,255,163,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingEmoji: {
    fontSize: 28,
    color: Colors.aurora.green,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.aurora.muted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,255,163,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIconText: {
    fontSize: 48,
    color: Colors.aurora.green,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.aurora.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.aurora.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: Colors.aurora.green,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
  },
  emptyButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
  },
  ctaButton: {
    backgroundColor: Colors.aurora.green,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.aurora.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
