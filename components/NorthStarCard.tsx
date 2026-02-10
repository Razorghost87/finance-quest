import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { NorthStarIcon } from './ui/NorthStarIcon';

interface NorthStarCardProps {
  netCashflow: number;
  confidence?: {
    score?: number;
    grade?: 'high' | 'medium' | 'low';
  };
  reconciliation?: {
    ok?: boolean | null;
    delta?: number | null;
  };
}

export function NorthStarCard({ netCashflow, confidence, reconciliation }: NorthStarCardProps) {
  const isPositive = netCashflow >= 0;
  const confidenceGrade = confidence?.grade || 'medium';
  const reconOk = reconciliation?.ok;
  return (
    <ThemedView style={styles.container}>
      {/* Aurora Glow Effect */}
      <View style={styles.glow} />

      <View style={styles.labelRow}>
        <NorthStarIcon size={14} color={Colors.aurora.faint} />
        <ThemedText style={styles.label}>NORTH STAR</ThemedText>
      </View>
      <View style={styles.headerRow}>
        <ThemedText style={styles.metricLabel}>Savings Trajectory</ThemedText>
        {isPositive && <View style={styles.trendIndicator} />}
      </View>

      <ThemedText style={[styles.metric, isPositive ? styles.positive : styles.negative]}>
        {isPositive ? '+' : ''}${Math.abs(netCashflow).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </ThemedText>

      <View style={styles.badges}>
        {confidence && (
          <ConfidenceBadge
            score={confidence.score}
            grade={confidenceGrade}
            showLabel={true}
          />
        )}

        {reconOk !== null && reconOk !== undefined && (
          <View style={[styles.badge, reconOk ? styles.badgeGood : styles.badgeWarning]}>
            <ThemedText style={styles.badgeText}>
              {reconOk ? 'Reconciled' : `Δ $${Math.abs(reconciliation?.delta || 0).toFixed(2)}`}
            </ThemedText>
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: Colors.aurora.card,
    borderWidth: 1,
    borderColor: Colors.aurora.border,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 227, 255, 0.08)', // Faint cyan glow
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.aurora.faint,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.aurora.text,
  },
  trendIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.aurora.green,
    marginLeft: 8,
    marginTop: 2,
  },
  metric: {
    fontSize: 56,
    fontWeight: '900', // Heavy impact
    marginBottom: 20,
    letterSpacing: -2,
    marginTop: 8,
  },
  positive: {
    color: Colors.aurora.green,
    textShadowColor: 'rgba(56, 255, 179, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  negative: {
    color: Colors.aurora.red,
  },
  badges: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.aurora.text,
  },
  badgeHigh: {
    borderColor: 'rgba(56, 255, 179, 0.3)',
    backgroundColor: 'rgba(56, 255, 179, 0.05)',
  },
  badgeMedium: {
    borderColor: 'rgba(251, 191, 36, 0.3)',
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
  },
  badgeLow: {
    borderColor: 'rgba(248, 113, 113, 0.3)',
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
  },
  badgeGood: {
    borderColor: Colors.aurora.border,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  badgeWarning: {
    borderColor: 'rgba(251, 191, 36, 0.3)',
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
  },
});

