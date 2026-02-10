import { ThemedText } from '@/components/themed-text';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NorthStarIcon } from '@/components/ui/NorthStarIcon';
import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();

  const handleCreateAccount = () => {
    router.push('/auth/sign-up');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <AuroraBackground>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }
        ]}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <NorthStarIcon size={36} color={Colors.aurora.green} withGlow />
          </View>
          <ThemedText type="title" style={styles.title}>
            North Star
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Unlock Total Financial Clarity.
          </ThemedText>
        </View>

        <View style={styles.features}>
          <FeatureRow
            icon="chart.pie"
            title="Stop Wondering"
            description="Know exactly where your money goes. No more fog."
          />
          <FeatureRow
            icon="calendar"
            title="Kill Hidden Costs"
            description="Spot recurring subscriptions before they drain you."
          />
          <FeatureRow
            icon="clock.arrow.circlepath"
            title="Predict the Future"
            description="See your financial trajectory months in advance."
          />
          <FeatureRow
            icon="target"
            title="Total Control"
            description="You decide where every single dollar goes."
          />
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed
            ]}
            onPress={handleCreateAccount}
          >
            <LinearGradient
              colors={[Colors.aurora.green, '#00D2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ThemedText style={styles.primaryButtonText}>
              Begin Journey
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleBack}
          >
            <ThemedText style={styles.secondaryButtonText}>
              Not now
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </AuroraBackground>
  );
}

function FeatureRow({ icon, title, description }: { icon: string, title: string, description: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <IconSymbol name={icon as any} size={24} color={Colors.aurora.cyan} />
      </View>
      <View style={styles.featureContent}>
        <ThemedText style={styles.featureTitle}>{title}</ThemedText>
        <ThemedText style={styles.featureDescription}>
          {description}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 255, 163, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 163, 0.2)',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: Colors.aurora.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.aurora.muted,
    fontWeight: '400',
  },
  features: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 48,
    gap: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  featureIconContainer: {
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
    color: Colors.aurora.text,
  },
  featureDescription: {
    fontSize: 15,
    color: Colors.aurora.muted,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 20,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Colors.aurora.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.aurora.muted,
  },
});
