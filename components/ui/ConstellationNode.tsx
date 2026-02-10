/**
 * Constellation Node Component
 * 
 * Orbiting elements around the North Star.
 * Places via polar coordinates from north-star-layout.
 */

import { Colors } from '@/constants/theme';
import { northHaptics } from '@/lib/haptics';
import { getNodeSize, getTouchPadding, MIN_TOUCH_TARGET } from '@/lib/north-star-layout';
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '../themed-text';

export interface ConstellationNodeData {
    id: string;
    label: string;
    type: 'insight' | 'confidence' | 'action';
    value?: string;
    importance?: number; // 0-1
}

interface ConstellationNodeProps {
    data: ConstellationNodeData;
    position: { x: number; y: number };
    onPress?: () => void;
    delay?: number;
}

export function ConstellationNode({
    data,
    position,
    onPress,
    delay = 0,
}: ConstellationNodeProps) {
    const size = getNodeSize(data.importance ?? 0.5);
    const padding = getTouchPadding(size);
    const touchSize = Math.max(size, MIN_TOUCH_TARGET);

    // Animation values
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const pressScale = useSharedValue(1);

    // Enter animation
    useEffect(() => {
        const timer = setTimeout(() => {
            scale.value = withSpring(1, { damping: 12, stiffness: 100 });
            opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
        }, delay);

        return () => clearTimeout(timer);
    }, [delay]);

    const handlePressIn = useCallback(() => {
        pressScale.value = withSpring(0.9);
        northHaptics.light();
    }, []);

    const handlePressOut = useCallback(() => {
        pressScale.value = withSpring(1);
    }, []);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value * pressScale.value },
        ],
        opacity: opacity.value,
    }));

    // Node colors based on type
    const getNodeColor = () => {
        switch (data.type) {
            case 'insight':
                return Colors.aurora.cyan;
            case 'confidence':
                return Colors.aurora.green;
            case 'action':
                return Colors.aurora.purple;
            default:
                return Colors.aurora.muted;
        }
    };

    const nodeColor = getNodeColor();

    return (
        <Animated.View
            style={[
                styles.container,
                containerStyle,
                {
                    position: 'absolute',
                    left: position.x - touchSize / 2,
                    top: position.y - touchSize / 2,
                },
            ]}
        >
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[styles.touchTarget, { width: touchSize, height: touchSize }]}
            >
                {/* Glow */}
                <View
                    style={[
                        styles.glow,
                        {
                            width: size * 1.5,
                            height: size * 1.5,
                            borderRadius: size * 0.75,
                            backgroundColor: nodeColor + '20',
                        },
                    ]}
                />

                {/* Core */}
                <View
                    style={[
                        styles.core,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            backgroundColor: nodeColor + '40',
                            borderColor: nodeColor,
                        },
                    ]}
                >
                    {data.value && (
                        <ThemedText style={[styles.value, { color: nodeColor }]}>
                            {data.value}
                        </ThemedText>
                    )}
                </View>

                {/* Label */}
                <View style={styles.labelContainer}>
                    <ThemedText style={styles.label} numberOfLines={1}>
                        {data.label}
                    </ThemedText>
                </View>
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
    glow: {
        position: 'absolute',
    },
    core: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    value: {
        fontSize: 10,
        fontWeight: '700',
    },
    labelContainer: {
        position: 'absolute',
        bottom: -18,
        maxWidth: 80,
    },
    label: {
        fontSize: 9,
        color: Colors.aurora.muted,
        textAlign: 'center',
    },
});
