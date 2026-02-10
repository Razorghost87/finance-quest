import { Colors } from '@/constants/theme';
import { UserTier } from '@/hooks/use-user-tier';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

export interface AuroraBackgroundProps {
    children?: React.ReactNode;
    tier?: UserTier;
}

export function AuroraBackground({ children, tier = 'north_star' }: AuroraBackgroundProps) {
    // Shared values for breathing animation
    const opacityMain = useSharedValue(tier === 'north_star' ? 0.8 : 0.4);
    const opacitySecondary = useSharedValue(tier === 'north_star' ? 0.6 : 0.2);
    const scale = useSharedValue(1);

    const isGuest = tier === 'guest';

    useEffect(() => {
        // Main auroras - Guest mode is much subtler and slower
        const mainTarget = isGuest ? 0.2 : 0.4;
        const mainDuration = isGuest ? 6000 : 4000;

        opacityMain.value = withRepeat(
            withTiming(mainTarget, { duration: mainDuration, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );

        const secTarget = isGuest ? 0.15 : 0.3;
        const secDuration = isGuest ? 7000 : 5000;

        // Secondary aurora pulses opacity slightly offset
        opacitySecondary.value = withDelay(
            1000,
            withRepeat(
                withTiming(secTarget, { duration: secDuration, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            )
        );

        // Slight scale breathing - minimal for guests
        const scaleTarget = isGuest ? 1.02 : 1.05;
        scale.value = withRepeat(
            withTiming(scaleTarget, { duration: 8000, easing: Easing.inOut(Easing.quad) }),
            -1,
            true
        );
    }, [isGuest]);

    const animatedMainStyle = useAnimatedStyle(() => ({
        opacity: opacityMain.value,
        transform: [{ scale: scale.value }]
    }));

    const animatedSecondaryStyle = useAnimatedStyle(() => ({
        opacity: opacitySecondary.value,
        transform: [{ scale: scale.value }]
    }));

    // Tier-specific colors
    const colorsMain = isGuest
        ? ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'transparent'] // Grey/White fog
        : ['rgba(76, 29, 149, 0.4)', 'rgba(0, 255, 163, 0.15)', 'transparent']; // Rich Purple/Green

    const colorsSec = isGuest
        ? ['rgba(255, 255, 255, 0.03)', 'transparent']
        : ['rgba(0, 210, 255, 0.08)', 'transparent']; // Cyan

    return (
        <View style={styles.container}>
            <View style={styles.background}>
                {/* Base Void */}
                <View style={styles.voidBase} />

                {/* Main Aurora Curtain (Top Right) */}
                <Animated.View style={[styles.auroraContainer, animatedMainStyle]}>
                    <LinearGradient
                        colors={colorsMain as any}
                        start={{ x: 0.8, y: 0 }}
                        end={{ x: 0.2, y: 0.6 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>

                {/* Secondary Glow (Bottom Left) */}
                <Animated.View style={[styles.auroraContainer, animatedSecondaryStyle]}>
                    <LinearGradient
                        colors={colorsSec as any}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 0.5, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>

                {/* Grain/Noise overlay could go here if we had an image */}
            </View>

            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.aurora.bg,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden', // Contain the scale animation
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
    voidBase: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
    },
    auroraContainer: {
        ...StyleSheet.absoluteFillObject,
    },
});
