import { Colors } from '@/constants/theme';
import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming
} from 'react-native-reanimated';

interface AuroraBarProps {
    value: number; // 0 to 1 (percentage)
    color?: string;
    height?: number;
    delay?: number;
    style?: ViewStyle;
}

export function AuroraBar({ value, color = Colors.aurora.cyan, height = 6, delay = 0, style }: AuroraBarProps) {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(delay, withTiming(value, { duration: 1500 }));
    }, [value, delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`
    }));

    return (
        <View style={[styles.container, { height }, style]}>
            {/* Background Track */}
            <View style={styles.track} />

            {/* Filling Bar */}
            <Animated.View style={[styles.fill, { backgroundColor: color }, animatedStyle]}>
                {/* Glow End Cap */}
                <View style={[styles.glow, { shadowColor: color }]} />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 999,
        justifyContent: 'center',
    },
    track: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 999,
    },
    fill: {
        height: '100%',
        borderRadius: 999,
        position: 'relative',
    },
    glow: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 10,
        borderRadius: 999,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 4,
        backgroundColor: 'rgba(255,255,255,0.8)', // White hot tip
    }
});
