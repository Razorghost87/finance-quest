import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

// Mock data for "This month at a glance"
const mockMonthlyData = {
  estimatedOutflow: 3240,
  estimatedInflow: 4500,
  topCategory: 'Groceries',
  keyInsight: 'You spent 15% more on subscriptions this month',
};

export default function HomeScreen() {
  const handleUploadStatement = () => {
    router.push('/(tabs)/upload');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          This Month at a Glance
        </ThemedText>

        <View style={styles.cardsContainer}>
          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardLabel}>Estimated Outflow</ThemedText>
            <ThemedText type="subtitle" style={styles.cardValue}>
              ${mockMonthlyData.estimatedOutflow.toLocaleString()}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardLabel}>Estimated Inflow</ThemedText>
            <ThemedText type="subtitle" style={styles.cardValue}>
              ${mockMonthlyData.estimatedInflow.toLocaleString()}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardLabel}>Top Category</ThemedText>
            <ThemedText type="subtitle" style={styles.cardValue}>
              {mockMonthlyData.topCategory}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardLabel}>Key Insight</ThemedText>
            <ThemedText style={styles.cardInsight}>
              {mockMonthlyData.keyInsight}
            </ThemedText>
          </ThemedView>
        </View>

        <Pressable style={styles.uploadButton} onPress={handleUploadStatement}>
          <ThemedText style={styles.uploadButtonText}>Upload Statement</ThemedText>
        </Pressable>
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
    marginBottom: 24,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  cardInsight: {
    fontSize: 16,
    opacity: 0.9,
    lineHeight: 22,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
