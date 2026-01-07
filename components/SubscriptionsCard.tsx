import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Subscription {
  merchant: string;
  amount: number;
  interval: string;
  confidence: number;
  nextExpectedDate?: string | null;
}

interface SubscriptionsCardProps {
  subscriptions: Subscription[];
}

export function SubscriptionsCard({ subscriptions }: SubscriptionsCardProps) {
  if (!subscriptions || subscriptions.length === 0) {
    return null;
  }

  // Calculate total monthly commitments
  const totalMonthly = subscriptions.reduce((sum, sub) => {
    if (sub.interval === 'monthly') return sum + sub.amount;
    if (sub.interval === 'weekly') return sum + (sub.amount * 4.33);
    if (sub.interval === 'annual') return sum + (sub.amount / 12);
    if (sub.interval === 'quarterly') return sum + (sub.amount / 3);
    return sum;
  }, 0);

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Subscriptions & Commitments</ThemedText>
      <ThemedText style={styles.totalLabel}>Total Monthly Commitments</ThemedText>
      <ThemedText style={styles.totalAmount}>${Math.round(totalMonthly).toLocaleString()}</ThemedText>
      
      <View style={styles.list}>
        {subscriptions.map((sub, index) => (
          <View key={index} style={styles.item}>
            <View style={styles.itemLeft}>
              <ThemedText style={styles.merchant}>{sub.merchant}</ThemedText>
              <ThemedText style={styles.interval}>
                {sub.interval === 'monthly' ? 'Monthly' : 
                 sub.interval === 'weekly' ? 'Weekly' :
                 sub.interval === 'annual' ? 'Annual' :
                 sub.interval === 'quarterly' ? 'Quarterly' : sub.interval}
              </ThemedText>
            </View>
            <View style={styles.itemRight}>
              <ThemedText style={styles.amount}>${sub.amount.toFixed(2)}</ThemedText>
              <View style={[styles.confidenceBadge, sub.confidence >= 0.7 ? styles.highConf : styles.medConf]}>
                <ThemedText style={styles.confidenceText}>
                  {Math.round(sub.confidence * 100)}%
                </ThemedText>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 20,
  },
  list: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  itemLeft: {
    flex: 1,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  interval: {
    fontSize: 13,
    color: '#888',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  confidenceBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  highConf: {
    backgroundColor: '#1a2e1a',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  medConf: {
    backgroundColor: '#2e2a1a',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});

