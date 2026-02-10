/**
 * North Dashboard — Step 3 Re-Anchored
 * 
 * North is a financial orientation system.
 * One question: "Am I drifting... or am I on course?"
 * 
 * Output:
 * 1. Direction: On Course / Drifting / Off Course
 * 2. Confidence
 * 3. Why (1-2 lines)
 * 4. Force Nodes (Income, Fixed, Flexible, Savings/Drift)
 * 
 * No charts. No budgeting. No forecasting.
 */

import { ThemedText } from '@/components/themed-text';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { DirectionVerdict } from '@/components/ui/DirectionVerdict';
import { ForceNodeSystem } from '@/components/ui/ForceNodeSystem';
import { Colors } from '@/constants/theme';
import { useUserTier } from '@/hooks/use-user-tier';
import {
  calculateDirection,
  calculateForceNodes,
  DirectionResult,
  ForceNode,
} from '@/lib/direction-engine';
import { northHaptics } from '@/lib/haptics';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DashboardState {
  direction: DirectionResult | null;
  nodes: ForceNode[];
  hasData: boolean;
  isLoading: boolean;
}

export default function Dashboard() {
  const tier = useUserTier();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<DashboardState>({
    direction: null,
    nodes: [],
    hasData: false,
    isLoading: true,
  });

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const fetchDashboardData = async () => {
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

      // Calculate direction using new engine
      const direction = calculateDirection(totals, categories, backendConfidence);

      // Calculate force nodes
      const nodes = calculateForceNodes(totals, categories);

      setState({
        direction,
        nodes,
        hasData: true,
        isLoading: false,
      });

    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
      setState({ direction: null, nodes: [], hasData: false, isLoading: false });
    }
  };

  const handleUpdateDirection = useCallback(() => {
    northHaptics.medium();
    router.push('/(tabs)/upload');
  }, []);

  const handleNodePress = useCallback((node: ForceNode) => {
    // Node interactions show impact, not just data
    console.log('Node pressed:', node);
  }, []);

  return (
    <AuroraBackground tier={tier}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 120 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Label */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.periodContainer}
        >
          <View style={styles.periodBadge}>
            <ThemedText style={styles.periodText}>
              {getCurrentPeriodLabel()}
            </ThemedText>
          </View>
        </Animated.View>

        {/* Main Content */}
        {state.isLoading ? (
          <LoadingState />
        ) : state.hasData && state.direction ? (
          <>
            {/* Direction Verdict - THE answer to "Am I okay?" */}
            <DirectionVerdict result={state.direction} />

            {/* Force Nodes - What's affecting direction */}
            {state.nodes.length > 0 && (
              <Animated.View entering={FadeIn.delay(600).duration(400)}>
                <ForceNodeSystem
                  nodes={state.nodes}
                  onNodePress={handleNodePress}
                />
              </Animated.View>
            )}
          </>
        ) : (
          <EmptyState onUpload={handleUpdateDirection} />
        )}
      </ScrollView>

      {/* Update Direction CTA - Always visible */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 24 }]}>
        <CTAButton
          label="Update my direction"
          onPress={handleUpdateDirection}
        />
      </View>
    </AuroraBackground>
  );
}

/**
 * Loading State
 */
function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <ThemedText style={styles.loadingText}>Loading your direction...</ThemedText>
    </View>
  );
}

/**
 * Empty State - First-time user
 */
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
        Upload a bank statement to see if you're on course or drifting.
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

/**
 * Get current period label
 */
function getCurrentPeriodLabel(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

/**
 * CTA Button Component
 */
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  periodContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  periodBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  periodText: {
    fontSize: 11,
    color: Colors.aurora.muted,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
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
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,255,163,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIconText: {
    fontSize: 36,
    color: Colors.aurora.green,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.aurora.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: Colors.aurora.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: Colors.aurora.green,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
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
