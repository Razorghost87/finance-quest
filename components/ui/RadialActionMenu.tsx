/**
 * Radial Action Menu
 * 
 * Appears on long-press of North Star.
 * Maximum 3 options, no modals, no context loss.
 */

import { Colors } from '@/constants/theme';
import { northHaptics } from '@/lib/haptics';
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { ThemedText } from '../themed-text';

export interface RadialAction {
    id: string;
    label: string;
    icon: string;
    onPress: () => void;
}

interface RadialActionMenuProps {
    visible: boolean;
    actions: RadialAction[];
    centerX: number;
    centerY: number;
    onDismiss: () => void;
}

export function RadialActionMenu({
    visible,
    actions,
    centerX,
    centerY,
    onDismiss,
}: RadialActionMenuProps) {
    const overlayOpacity = useSharedValue(0);
    const menuScale = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            overlayOpacity.value = withTiming(1, { duration: 200 });
            menuScale.value = withSpring(1, { damping: 15, stiffness: 150 });
        } else {
            overlayOpacity.value = withTiming(0, { duration: 150 });
            menuScale.value = withTiming(0, { duration: 100 });
        }
    }, [visible]);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
        pointerEvents: visible ? 'auto' : 'none',
    }));

    if (!visible && menuScale.value === 0) return null;

    // Calculate positions for actions (max 3, arranged in arc)
    const radius = 80;
    const startAngle = -Math.PI / 2 - Math.PI / 4; // Start at top-left
    const angleStep = Math.PI / 2 / Math.max(1, actions.length - 1);

    return (
        <Animated.View style={[styles.overlay, overlayStyle]}>
            <Pressable style={styles.backdrop} onPress={onDismiss} />

            {actions.slice(0, 3).map((action, index) => {
                const angle = actions.length === 1
                    ? -Math.PI / 2
                    : startAngle + angleStep * index;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;

                return (
                    <RadialActionButton
                        key={action.id}
                        action={action}
                        x={x}
                        y={y}
                        delay={index * 50}
                        visible={visible}
                        onDismiss={onDismiss}
                    />
                );
            })}
        </Animated.View>
    );
}

function RadialActionButton({
    action,
    x,
    y,
    delay,
    visible,
    onDismiss,
}: {
    action: RadialAction;
    x: number;
    y: number;
    delay: number;
    visible: boolean;
    onDismiss: () => void;
}) {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            scale.value = withDelay(delay, withSpring(1, { damping: 12 }));
            opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
        } else {
            scale.value = withTiming(0, { duration: 100 });
            opacity.value = withTiming(0, { duration: 100 });
        }
    }, [visible, delay]);

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePress = useCallback(() => {
        northHaptics.medium();
        action.onPress();
        onDismiss();
    }, [action, onDismiss]);

    return (
        <Animated.View
            style={[
                styles.actionButton,
                buttonStyle,
                {
                    position: 'absolute',
                    left: x - 32,
                    top: y - 32,
                },
            ]}
        >
            <Pressable onPress={handlePress} style={styles.actionTouchable}>
                <View style={styles.actionIcon}>
                    <ThemedText style={styles.actionIconText}>{action.icon}</ThemedText>
                </View>
                <ThemedText style={styles.actionLabel}>{action.label}</ThemedText>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    actionButton: {
        alignItems: 'center',
        width: 64,
    },
    actionTouchable: {
        alignItems: 'center',
        padding: 8,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.aurora.card,
        borderWidth: 1,
        borderColor: Colors.aurora.green + '40',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    actionIconText: {
        fontSize: 20,
    },
    actionLabel: {
        fontSize: 11,
        color: Colors.aurora.text,
        textAlign: 'center',
    },
});
