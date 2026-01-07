import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

const goalTemplates = [
  {
    id: 1,
    title: 'Emergency Fund',
    description: 'Build a safety net for unexpected expenses',
    target: '$10,000',
    status: 'coming soon',
  },
  {
    id: 2,
    title: 'Monthly Savings',
    description: 'Set a monthly savings target',
    target: '$500/month',
    status: 'coming soon',
  },
  {
    id: 3,
    title: 'Net Worth Milestone',
    description: 'Reach a specific net worth goal',
    target: '$50,000',
    status: 'coming soon',
  },
];

export default function GoalsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Goals
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Track your financial goals and milestones
        </ThemedText>

        <View style={styles.goalsContainer}>
          {goalTemplates.map((goal) => (
            <ThemedView key={goal.id} style={styles.goalCard}>
              <ThemedText type="subtitle" style={styles.goalTitle}>
                {goal.title}
              </ThemedText>
              <ThemedText style={styles.goalDescription}>
                {goal.description}
              </ThemedText>
              <View style={styles.goalFooter}>
                <ThemedText style={styles.goalTarget}>Target: {goal.target}</ThemedText>
                <ThemedView style={styles.comingSoonBadge}>
                  <ThemedText style={styles.comingSoonText}>Coming Soon</ThemedText>
                </ThemedView>
              </View>
            </ThemedView>
          ))}
        </View>

        <ThemedView style={styles.infoCard}>
          <ThemedText style={styles.infoText}>
            Goal tracking will be available soon. Create an account to save and track your progress.
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 24,
  },
  goalsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  goalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  goalDescription: {
    fontSize: 15,
    opacity: 0.8,
    marginBottom: 16,
    lineHeight: 22,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTarget: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  comingSoonBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    textAlign: 'center',
  },
});

