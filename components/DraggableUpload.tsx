
import { Colors } from '@/constants/theme';
import { northHaptics } from '@/lib/haptics';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';

const UPLOAD_THRESHOLD = -150;

interface DraggableUploadProps {
    onUploadTrigger: () => void;
    isUploading: boolean;
}

export function DraggableUpload({ onUploadTrigger, isUploading }: DraggableUploadProps) {
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const context = useSharedValue({ y: 0 });

    const gesture = Gesture.Pan()
        .enabled(!isUploading)
        .onBegin(() => {
            context.value = { y: translateY.value };
            scale.value = withSpring(1.1);
            runOnJS(northHaptics.light)();
        })
        .onUpdate((event) => {
            // Rubber banding effect
            // The further you drag, the harder it gets
            const resistance = 0.5;
            translateY.value = event.translationY * resistance + context.value.y;

            // Haptic feedback as we approach threshold
            if (translateY.value < UPLOAD_THRESHOLD + 20 && translateY.value > UPLOAD_THRESHOLD - 20) {
                // ideally throttle this, but for now just let it be physical
            }
        })
        .onEnd(() => {
            if (translateY.value < UPLOAD_THRESHOLD) {
                // Trigger upload
                runOnJS(northHaptics.heavy)();
                runOnJS(onUploadTrigger)();
            }

            // Snap back always
            translateY.value = withSpring(0);
            scale.value = withSpring(1);
        });

    const rStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: translateY.value },
                { scale: scale.value }
            ],
            shadowOpacity: interpolate(
                translateY.value,
                [0, UPLOAD_THRESHOLD],
                [0.3, 0.8],
                Extrapolation.CLAMP
            ),
            shadowRadius: interpolate(
                translateY.value,
                [0, UPLOAD_THRESHOLD],
                [10, 30],
                Extrapolation.CLAMP
            )
        };
    });

    const glowStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                translateY.value,
                [0, UPLOAD_THRESHOLD],
                [0.2, 1],
                Extrapolation.CLAMP
            )
        };
    });

    const arrowStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                translateY.value,
                [0, UPLOAD_THRESHOLD / 2],
                [1, 0],
                Extrapolation.CLAMP
            ),
            transform: [
                { translateY: interpolate(translateY.value, [0, UPLOAD_THRESHOLD], [0, -20]) }
            ]
        };
    });

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.arrowContainer, arrowStyle]}>
                <ThemedText style={styles.hintText}>Swipe Up to Upload</ThemedText>
                <IconSymbol name="chevron.up" size={24} color={Colors.aurora.muted} />
            </Animated.View>

            <GestureDetector gesture={gesture}>
                <Animated.View style={[styles.orb, rStyle]}>
                    <Animated.View style={[styles.glow, glowStyle]} />
                    <IconSymbol
                        name={isUploading ? "arrow.triangle.2.circlepath" : "icloud.and.arrow.up.fill"}
                        size={32}
                        color={isUploading ? Colors.aurora.muted : Colors.aurora.bg}
                    />
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: 200,
        marginBottom: 40,
    },
    arrowContainer: {
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    hintText: {
        fontSize: 12,
        color: Colors.aurora.muted,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontWeight: '600',
    },
    orb: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.aurora.green,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.aurora.green,
        shadowOffset: { width: 0, height: 0 },
        elevation: 10,
        zIndex: 10,
    },
    glow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 40,
        backgroundColor: Colors.aurora.cyan,
        opacity: 0.2,
    }
});
