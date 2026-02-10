/**
 * North Star Core Component
 * 
 * The gravitational center of the app.
 * Everything orbits it. Nothing competes with it.
 * 
 * Features:
 * - Always mathematically centered
 * - Direction-based aurora glow
 * - Long-press to add node
 * - Subtle idle rotation
 */

import { northHaptics } from '@/lib/haptics';
import {
    Direction,
    getDirectionVisuals,
    getStarDiameter,
    MIN_TOUCH_TARGET
} from '@/lib/north-star-layout';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { ThemedText } from '../themed-text';

interface NorthStarCoreProps {
    direction: Direction;
    confidence: number; // 0-1
    netCashflow: number;
    onPress?: () => void;
    onLongPress?: () => void;
}

export function NorthStarCore({
    direction,
    confidence,
    netCashflow,
    onPress,
    onLongPress,
}: NorthStarCoreProps) {
    const diameter = getStarDiameter();
    const visuals = getDirectionVisuals(direction);

    // Animation values
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const glowOpacity = useSharedValue(visuals.glowIntensity);
    const pulseScale = useSharedValue(1);

    // Idle rotation animation (very slow)
    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 60000, easing: Easing.linear }),
            -1, // infinite
            false
        );
    }, []);

    // Direction-based pulse animation
    useEffect(() => {
        if (visuals.motionType === 'pulse') {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        } else {
            pulseScale.value = withTiming(1, { duration: 500 });
        }
    }, [visuals.motionType]);

    // Update glow based on confidence
    useEffect(() => {
        glowOpacity.value = withTiming(
            visuals.glowIntensity * (0.5 + confidence * 0.5),
            { duration: 500 }
        );
    }, [confidence, visuals.glowIntensity]);

    const handlePressIn = useCallback(() => {
        scale.value = withSpring(0.95);
        northHaptics.light();
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1);
    }, []);

    const handleLongPress = useCallback(() => {
        northHaptics.medium();
        onLongPress?.();
    }, [onLongPress]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value * pulseScale.value },
        ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [
            { rotate: `${rotation.value}deg` },
        ],
    }));

    // Format cashflow for display
    const formatCashflow = (n: number) => {
        const abs = Math.abs(n);
        const formatted = abs >= 1000
            ? `${(abs / 1000).toFixed(1)}k`
            : abs.toLocaleString();
        return n >= 0 ? `+$${formatted}` : `-$${formatted}`;
    };

    // Direction emoji
    const directionEmoji = direction === 'improving' ? '↑' : direction === 'declining' ? '↓' : '→';
    const directionLabel = direction === 'improving' ? 'Improving' : direction === 'declining' ? 'Declining' : 'Stable';

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onLongPress={handleLongPress}
                delayLongPress={500}
                style={[
                    styles.touchTarget,
                    {
                        width: Math.max(diameter, MIN_TOUCH_TARGET),
                        height: Math.max(diameter, MIN_TOUCH_TARGET),
                    }
                ]}
            >
                {/* Outer glow */}
                <Animated.View style={[styles.glowOuter, glowStyle, { width: diameter * 1.8, height: diameter * 1.8 }]}>
                    <LinearGradient
                        colors={[visuals.primaryColor + '40', visuals.secondaryColor + '20', 'transparent']}
                        style={styles.glowGradient}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    />
                </Animated.View>

                {/* Inner glow ring */}
                <Animated.View style={[styles.glowInner, glowStyle, { width: diameter * 1.3, height: diameter * 1.3 }]}>
                    <LinearGradient
                        colors={[visuals.primaryColor + '60', visuals.secondaryColor + '30', 'transparent']}
                        style={styles.glowGradient}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                    />
                </Animated.View>

                {/* Core star */}
                <View style={[styles.core, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
                    <LinearGradient
                        colors={[visuals.primaryColor, visuals.secondaryColor]}
                        style={[styles.coreGradient, { borderRadius: diameter / 2 }]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.coreContent}>
                            <ThemedText style={[styles.directionEmoji, { color: '#000' }]}>
                                {directionEmoji}
                            </ThemedText>
                            <ThemedText style={[styles.cashflow, { color: '#000' }]}>
                                {formatCashflow(netCashflow)}
                            </ThemedText>
                            <ThemedText style={[styles.directionLabel, { color: 'rgba(0,0,0,0.7)' }]}>
                                {directionLabel}
                            </ThemedText>
                        </View>
                    </LinearGradient>
                </View>

                {/* Confidence ring */}
                <View style={[styles.confidenceRing, {
                    width: diameter + 16,
                    height: diameter + 16,
                    borderRadius: (diameter + 16) / 2,
                    borderColor: visuals.primaryColor + '40',
                }]} />
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    touchTarget: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowOuter: {
        position: 'absolute',
        borderRadius: 999,
        overflow: 'hidden',
    },
    glowInner: {
        position: 'absolute',
        borderRadius: 999,
        overflow: 'hidden',
    },
    glowGradient: {
        flex: 1,
        borderRadius: 999,
    },
    core: {
        overflow: 'hidden',
        shadowColor: '#00FFA3',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    coreGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    coreContent: {
        alignItems: 'center',
        gap: 2,
    },
    directionEmoji: {
        fontSize: 20,
        fontWeight: '700',
    },
    cashflow: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    directionLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    confidenceRing: {
        position: 'absolute',
        borderWidth: 2,
    },
});
