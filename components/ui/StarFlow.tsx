import { Colors } from '@/constants/theme';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { NorthStarIcon } from './NorthStarIcon';

const { width, height } = Dimensions.get('window');
const STAR_COUNT = 15;

function StarParticle({ index }: { index: number }) {
    // Randomize initial parameters
    const startX = Math.random() * width;
    const duration = 3000 + Math.random() * 2000;
    const delay = Math.random() * 2000;
    const size = 8 + Math.random() * 8; // Random size 8-16

    const translateY = useSharedValue(height);
    const opacity = useSharedValue(0);

    useEffect(() => {
        // Continuous upward flow
        translateY.value = withDelay(
            delay,
            withRepeat(
                withTiming(-100, { duration: duration, easing: Easing.linear }),
                -1,
                false
            )
        );

        // Fade in/out
        opacity.value = withDelay(
            delay,
            withRepeat(
                withTiming(1, { duration: duration / 2 }),
                -1,
                true
            )
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [
            { translateX: startX },
            { translateY: translateY.value }
        ],
        opacity: opacity.value,
        position: 'absolute',
        left: 0,
        top: 0,
    }));

    return (
        <Animated.View style={style}>
            <NorthStarIcon size={size} color={Colors.aurora.green} withGlow={Math.random() > 0.5} />
        </Animated.View>
    );
}

export function StarFlow({ intensity = 1 }: { intensity?: number }) {
    // Basic intensity scaling for particle count
    const starCount = Math.floor(STAR_COUNT * intensity);

    return (
        <View style={styles.container} pointerEvents="none">
            {Array.from({ length: starCount }).map((_, i) => (
                <StarParticle key={i} index={i} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden',
    },
});
