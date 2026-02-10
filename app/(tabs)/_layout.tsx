import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NorthStarIcon } from '@/components/ui/NorthStarIcon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function FloatingTabButton(props: any) {
  const { children, onPress } = props;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.floatingButtonContainer,
        pressed && styles.pressed
      ]}
      onPress={onPress}
    >
      <View style={styles.floatingButton}>
        {children}
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'dark'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'dark'].tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors.aurora.bg,
          borderTopColor: Colors.aurora.border,
          height: Platform.OS === 'ios' ? 88 : 60, // Taller tab bar
          paddingTop: 8,
        },
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="doc.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="north_star"
        options={{
          // Empty title so label doesn't show twice or conflict
          title: '',
          tabBarLabel: '',
          tabBarButton: (props) => (
            <FloatingTabButton {...props}>
              <NorthStarIcon size={32} color={Colors.aurora.bg} />
            </FloatingTabButton>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="clock.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="auros"
        options={{
          title: 'Auros',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="sparkles" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingButtonContainer: {
    top: -20, // Float up
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.aurora.green, // Main brand color
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.aurora.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 4,
    borderColor: Colors.aurora.bg, // Create "cutout" effect
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }]
  }
});
