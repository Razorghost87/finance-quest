import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface PaywallPromptProps {
  onDismiss: () => void;
  onUpgrade: () => void;
}

export function PaywallPrompt({ onDismiss, onUpgrade }: PaywallPromptProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  return (
    <ThemedView style={styles.overlay}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Unlock Full Access
        </ThemedText>
        <ThemedText style={styles.description}>
          You've viewed your free summary. Upgrade to unlock:
        </ThemedText>
        <View style={styles.features}>
          <ThemedText style={styles.feature}>✓ Unlimited document uploads</ThemedText>
          <ThemedText style={styles.feature}>✓ Detailed analysis & insights</ThemedText>
          <ThemedText style={styles.feature}>✓ Export reports</ThemedText>
          <ThemedText style={styles.feature}>✓ Priority support</ThemedText>
        </View>
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.upgradeButton]}
            onPress={onUpgrade}
          >
            <ThemedText style={styles.upgradeButtonText}>Upgrade Now</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.button, styles.dismissButton]}
            onPress={onDismiss}
          >
            <ThemedText style={styles.dismissButtonText}>Maybe Later</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    borderWidth: 1,
    borderColor: '#333',
    maxWidth: 400,
    width: '90%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.8,
  },
  features: {
    marginBottom: 24,
    gap: 12,
  },
  feature: {
    fontSize: 15,
    opacity: 0.9,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333',
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.8,
  },
});

