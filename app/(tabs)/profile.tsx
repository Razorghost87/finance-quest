import { ThemedText } from '@/components/themed-text';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useUserTier } from '@/hooks/use-user-tier';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function ProfileScreen() {
  const tier = useUserTier();
  const isPaid = tier === 'north_star';

  const handleCreateAccount = () => {
    router.push('/auth/login');
  };

  const handleUpgrade = () => {
    router.push('/paywall');
  };

  return (
    <AuroraBackground tier={tier}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Profile Header */}
        <View style={styles.header}>
          <View style={[styles.avatarPlaceholder, isPaid && styles.avatarPaid]}>
            <IconSymbol name={isPaid ? "star.fill" : "person.fill"} size={40} color={isPaid ? Colors.aurora.green : Colors.aurora.text} />
          </View>
          <View style={styles.headerTexts}>
            <ThemedText type="title" style={styles.name}>{isPaid ? 'North Star Guide' : 'Guest Voyager'}</ThemedText>
            <View style={[styles.badge, isPaid && styles.badgePaid]}>
              <ThemedText style={[styles.badgeText, isPaid && styles.badgeTextPaid]}>
                {isPaid ? 'Premium Access' : 'Start Here'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Action Card: Sign Up or Upgrade */}
        {!isPaid ? (
          <View style={styles.promoCard}>
            <View style={styles.promoContent}>
              <ThemedText style={styles.promoTitle}>Claim your North Star</ThemedText>
              <ThemedText style={styles.promoDesc}>
                Create an account to save your history, track trends, and unlock personalized insights.
              </ThemedText>
            </View>
            <Pressable style={styles.ctaButton} onPress={handleCreateAccount}>
              <ThemedText style={styles.ctaText}>Create Account</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.statsCard}>
            <ThemedText style={styles.statsTitle}>Lifetime Impact</ThemedText>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>Active</ThemedText>
                <ThemedText style={styles.statLabel}>Status</ThemedText>
              </View>
              <View style={styles.statLine} />
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>∞ </ThemedText>
                <ThemedText style={styles.statLabel}>Uploads</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Menu Links */}
        <View style={styles.menu}>
          <MenuItem
            icon="clock"
            label="Financial History"
            onPress={() => router.push('/history')}
            subtitle="View past statements"
          />
          {!isPaid && (
            <MenuItem
              icon="star"
              label="Upgrade to North Star"
              onPress={handleUpgrade}
              subtitle="Unlock full potential"
              isHighlight
            />
          )}
          <MenuItem
            icon="gear"
            label="Settings"
            onPress={() => { }}
            subtitle="App preferences"
          />
          <MenuItem
            icon="shield"
            label="Privacy & Security"
            onPress={() => { }}
            subtitle="Your data is encrypted"
          />
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.version}>North v1.0.0 (Orbit 8)</ThemedText>
        </View>

      </ScrollView>
    </AuroraBackground>
  );
}

function MenuItem({ icon, label, subtitle, onPress, isHighlight }: { icon: string, label: string, subtitle?: string, onPress: () => void, isHighlight?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, isHighlight && styles.menuItemHighlight, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuIconBox, isHighlight && styles.iconHighlight]}>
        <IconSymbol name={icon as any} size={20} color={isHighlight ? '#000' : Colors.aurora.cyan} />
      </View>
      <View style={styles.menuTexts}>
        <ThemedText style={[styles.menuLabel, isHighlight && styles.textHighlight]}>{label}</ThemedText>
        {subtitle && <ThemedText style={[styles.menuSubtitle, isHighlight && styles.textHighlight]}>{subtitle}</ThemedText>}
      </View>
      <IconSymbol name="chevron.right" size={14} color={isHighlight ? '#000' : Colors.aurora.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 100 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.aurora.border,
    marginRight: 16,
  },
  avatarPaid: {
    borderColor: Colors.aurora.green,
    backgroundColor: 'rgba(0, 255, 163, 0.1)',
  },
  headerTexts: { flex: 1 },
  name: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  badgePaid: {
    backgroundColor: Colors.aurora.green,
  },
  badgeText: { fontSize: 12, color: Colors.aurora.muted, textTransform: 'uppercase' },
  badgeTextPaid: { color: '#000', fontWeight: '700' },

  promoCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)', // subtle blue tint
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    gap: 20,
  },
  promoContent: { gap: 8 },
  promoTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  promoDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
  ctaButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: { color: '#000', fontWeight: '700', fontSize: 16 },

  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.aurora.border,
  },
  statsTitle: { fontSize: 14, color: Colors.aurora.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.aurora.green },
  statLabel: { fontSize: 12, color: Colors.aurora.muted, marginTop: 4 },
  statLine: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },


  menu: { gap: 12 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  menuItemPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  menuItemHighlight: { backgroundColor: Colors.aurora.green, borderColor: Colors.aurora.green },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0, 210, 255, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  iconHighlight: { backgroundColor: '#fff' },
  textHighlight: { color: '#000' },

  menuTexts: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '600', color: Colors.aurora.text },
  menuSubtitle: { fontSize: 13, color: Colors.aurora.muted, marginTop: 2 },

  footer: { marginTop: 48, alignItems: 'center' },
  version: { fontSize: 12, color: Colors.aurora.muted, opacity: 0.5 },
});
