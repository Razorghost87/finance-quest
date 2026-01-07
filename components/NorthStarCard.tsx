import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

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
      <ThemedText style={styles.label}>North Star</ThemedText>
      <ThemedText style={styles.metricLabel}>Savings Trajectory</ThemedText>
      <ThemedText style={[styles.metric, isPositive ? styles.positive : styles.negative]}>
        {isPositive ? '+' : ''}${Math.abs(netCashflow).toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </ThemedText>
      <View style={styles.badges}>
        {confidenceGrade && (
          <View style={[styles.badge, styles[`badge${confidenceGrade.charAt(0).toUpperCase() + confidenceGrade.slice(1)}`]]}>
            <ThemedText style={styles.badgeText}>
              {confidenceGrade === 'high' ? '✓ High' : confidenceGrade === 'medium' ? '~ Medium' : '? Low'} Confidence
            </ThemedText>
          </View>
        )}
        {reconOk !== null && reconOk !== undefined && (
          <View style={[styles.badge, reconOk ? styles.badgeGood : styles.badgeWarning]}>
            <ThemedText style={styles.badgeText}>
              {reconOk ? '✓ Reconciled' : `Δ $${Math.abs(reconciliation?.delta || 0).toFixed(2)}`}
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
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricLabel: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 12,
  },
  metric: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  positive: {
    color: '#4ade80',
  },
  negative: {
    color: '#f87171',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeHigh: {
    borderColor: '#4ade80',
    backgroundColor: '#1a2e1a',
  },
  badgeMedium: {
    borderColor: '#fbbf24',
    backgroundColor: '#2e2a1a',
  },
  badgeLow: {
    borderColor: '#f87171',
    backgroundColor: '#2e1a1a',
  },
  badgeGood: {
    borderColor: '#4ade80',
    backgroundColor: '#1a2e1a',
  },
  badgeWarning: {
    borderColor: '#fbbf24',
    backgroundColor: '#2e2a1a',
  },
});

