
import { Colors } from '@/constants/theme';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const NUM_PARTICLES = 20;

// Helper to generate random number in range
const random = (min: number, max: number) => Math.random() * (max - min) + min;

export function ParticleBurst({ trigger }: { trigger: boolean }) {
    if (!trigger) return null;

    // Create an array of particles
    return (
        <View style={styles.container} pointerEvents="none">
            {Array.from({ length: NUM_PARTICLES }).map((_, i) => (
                <Particle key={i} index={i} />
            ))}
        </View>
    );
}

function Particle({ index }: { index: number }) {
    const angle = random(0, 360) * (Math.PI / 180); // Random angle in radians
    const distance = random(100, 250); // Burst distance
    const delay = random(0, 100);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);
    const scale = useSharedValue(0);

    useEffect(() => {
        // burst out
        const duration = random(600, 1000);

        scale.value = withDelay(delay, withSpring(random(0.5, 1.2)));

        translateX.value = withDelay(delay, withTiming(Math.cos(angle) * distance, { duration }));
        translateY.value = withDelay(delay, withTiming(Math.sin(angle) * distance, { duration }));

        opacity.value = withDelay(delay + duration * 0.6, withTiming(0, { duration: 300 }));
    }, []);

    const rStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value }
        ]
    }));

    return (
        <Animated.View style={[styles.particle, rStyle, { backgroundColor: index % 2 === 0 ? Colors.aurora.green : Colors.aurora.cyan }]} />
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
    },
    particle: {
        width: 8,
        height: 8,
        borderRadius: 4,
        position: 'absolute',
    }
});
