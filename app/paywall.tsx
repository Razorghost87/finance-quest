import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function PaywallScreen() {
  const handleCreateAccount = () => {
    // Navigate to account creation (to be implemented)
    alert('Account creation will be implemented here');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          North Plus
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Unlock your full financial picture
        </ThemedText>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>✓</ThemedText>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Full Category Breakdown</ThemedText>
              <ThemedText style={styles.featureDescription}>
                See every transaction categorized automatically
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>✓</ThemedText>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Recurring Subscriptions</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Track and manage all your recurring payments
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>✓</ThemedText>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Month-to-Month Tracking</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Compare spending patterns across months
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>✓</ThemedText>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Goals Progress</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Track your savings goals with real-time progress
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureIcon}>✓</ThemedText>
            <View style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>Smart Reminders</ThemedText>
              <ThemedText style={styles.featureDescription}>
                Get alerts for bills, goals, and spending patterns
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleCreateAccount}
          >
            <ThemedText style={styles.primaryButtonText}>
              Create Account & Unlock
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleBack}
          >
            <ThemedText style={styles.secondaryButtonText}>
              Maybe Later
            </ThemedText>
          </Pressable>
        </View>
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
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
    opacity: 0.7,
  },
  features: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 40,
    gap: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIcon: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: '700',
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.95,
  },
  featureDescription: {
    fontSize: 15,
    opacity: 0.7,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
});
