import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function ProfileScreen() {
  const handleCreateAccount = () => {
    // Navigate to account creation (to be implemented)
    alert('Account creation will be implemented here');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Profile
        </ThemedText>

        <ThemedView style={styles.guestCard}>
          <ThemedText type="subtitle" style={styles.guestTitle}>
            Guest Mode
          </ThemedText>
          <ThemedText style={styles.guestText}>
            You&apos;re currently using the app as a guest. Your data is stored locally and will not be synced across devices.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.privacyCard}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Privacy & Security
          </ThemedText>
          <ThemedText style={styles.privacyText}>
            • Your financial data is processed securely{'\n'}
            • Documents are stored privately in your account{'\n'}
            • No data is shared with third parties{'\n'}
            • You can delete your data at any time
          </ThemedText>
        </ThemedView>

        <Pressable style={styles.createAccountButton} onPress={handleCreateAccount}>
          <ThemedText style={styles.createAccountButtonText}>
            Create Account to Save & Track
          </ThemedText>
        </Pressable>

        <ThemedView style={styles.benefitsCard}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            With an account, you can:
          </ThemedText>
          <View style={styles.benefitsList}>
            <ThemedText style={styles.benefitItem}>✓ Save your reports and history</ThemedText>
            <ThemedText style={styles.benefitItem}>✓ Track spending month-to-month</ThemedText>
            <ThemedText style={styles.benefitItem}>✓ Set and monitor financial goals</ThemedText>
            <ThemedText style={styles.benefitItem}>✓ Get personalized insights</ThemedText>
            <ThemedText style={styles.benefitItem}>✓ Sync across all your devices</ThemedText>
          </View>
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
    marginBottom: 24,
  },
  guestCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  guestText: {
    fontSize: 15,
    opacity: 0.8,
    lineHeight: 22,
  },
  privacyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  privacyText: {
    fontSize: 15,
    opacity: 0.8,
    lineHeight: 24,
  },
  createAccountButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  createAccountButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  benefitsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    fontSize: 15,
    opacity: 0.9,
    lineHeight: 22,
  },
});

