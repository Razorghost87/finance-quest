/**
 * Processing Ritual Component
 * 
 * The guided journey during statement analysis.
 * Never feels stuck. Always shows progress.
 * 
 * Features:
 * - Immediate visual feedback
 * - Hybrid progress bar
 * - Stage labels
 * - Time expectation messaging
 * - Aurora visuals tied to progress
 */

import { Colors } from '@/constants/theme';
import { northHaptics } from '@/lib/haptics';
import { formatProgress, useHybridProgress } from '@/lib/processing-progress';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { ThemedText } from '../themed-text';

interface ProcessingRitualProps {
    /** Backend progress 0-100 */
    backendProgress: number;
    /** Current stage from backend */
    stage: string;
    /** Whether processing is complete */
    isDone: boolean;
    /** Error message if failed */
    error?: string | null;
    /** Callback when done */
    onComplete?: () => void;
    /** Callback to retry */
    onRetry?: () => void;
    /** Callback to go back */
    onBack?: () => void;
}

export function ProcessingRitual({
    backendProgress,
    stage,
    isDone,
    error,
    onComplete,
    onRetry,
    onBack,
}: ProcessingRitualProps) {
    const hasError = !!error;

    // Hybrid progress system
    const { displayProgress, stageLabel, timeMessage, elapsedSeconds } = useHybridProgress({
        backendProgress,
        stage,
        isDone,
        hasError,
    });

    // Animation values
    const pulseScale = useSharedValue(1);
    const glowOpacity = useSharedValue(0.3);
    const starRotation = useSharedValue(0);

    // Immediate feedback - start animations instantly
    useEffect(() => {
        // Pulse animation
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Slow rotation
        starRotation.value = withRepeat(
            withTiming(360, { duration: 30000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    // Glow intensity tied to progress
    useEffect(() => {
        glowOpacity.value = withTiming(
            0.3 + (displayProgress / 100) * 0.5,
            { duration: 300 }
        );
    }, [displayProgress]);

    // Complete callback
    useEffect(() => {
        if (isDone && !hasError) {
            northHaptics.success();
            onComplete?.();
        }
    }, [isDone, hasError, onComplete]);

    const starStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: pulseScale.value },
            { rotate: `${starRotation.value}deg` },
        ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    // Error state
    if (hasError) {
        return (
            <View style={styles.container}>
                <ErrorState
                    message={error}
                    onRetry={onRetry}
                    onBack={onBack}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Star visualization */}
            <Animated.View entering={FadeIn.duration(200)} style={styles.starContainer}>
                <Animated.View style={[styles.glow, glowStyle]} />
                <Animated.View style={[styles.star, starStyle]}>
                    <ThemedText style={styles.starIcon}>✦</ThemedText>
                </Animated.View>
            </Animated.View>

            {/* Stage label */}
            <Animated.View
                entering={FadeInDown.delay(100).duration(300)}
                style={styles.stageContainer}
            >
                <ThemedText style={styles.stageLabel}>{stageLabel}</ThemedText>
            </Animated.View>

            {/* Progress bar */}
            <Animated.View
                entering={FadeInDown.delay(200).duration(300)}
                style={styles.progressContainer}
            >
                <View style={styles.progressTrack}>
                    <Animated.View
                        style={[
                            styles.progressFill,
                            { width: `${displayProgress}%` }
                        ]}
                    />
                </View>
                <ThemedText style={styles.progressText}>
                    {formatProgress(displayProgress)}
                </ThemedText>
            </Animated.View>

            {/* Time message */}
            <Animated.View
                entering={FadeIn.delay(500).duration(300)}
                style={styles.timeContainer}
            >
                <ThemedText style={styles.timeMessage}>{timeMessage}</ThemedText>
            </Animated.View>
        </View>
    );
}

/**
 * Error State - Always has 2 exits: Retry and Go Back
 */
function ErrorState({
    message,
    onRetry,
    onBack
}: {
    message?: string | null;
    onRetry?: () => void;
    onBack?: () => void;
}) {
    // Human-readable error message
    const displayMessage = humanizeError(message);

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.errorContainer}
        >
            <View style={styles.errorIcon}>
                <ThemedText style={styles.errorIconText}>⚠️</ThemedText>
            </View>

            <ThemedText style={styles.errorTitle}>
                Couldn't complete analysis
            </ThemedText>

            <ThemedText style={styles.errorMessage}>
                {displayMessage}
            </ThemedText>

            {/* Always 2 exits - never strand the user */}
            <View style={styles.errorActions}>
                {onRetry && (
                    <Pressable
                        onPress={() => { northHaptics.medium(); onRetry(); }}
                        style={styles.retryButton}
                    >
                        <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
                    </Pressable>
                )}
                {onBack && (
                    <Pressable
                        onPress={() => { northHaptics.light(); onBack(); }}
                        style={styles.backButton}
                    >
                        <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
                    </Pressable>
                )}
            </View>
        </Animated.View>
    );
}

/**
 * Convert technical errors to human-readable messages
 */
function humanizeError(error?: string | null): string {
    if (!error) return 'Something went wrong. Please try again.';

    const lower = error.toLowerCase();

    if (lower.includes('timeout')) {
        return 'The analysis took too long. Try a smaller file or a clearer PDF.';
    }
    if (lower.includes('pdf') || lower.includes('extract')) {
        return "We couldn't read this statement clearly. Try a clearer PDF or take a photo.";
    }
    if (lower.includes('network') || lower.includes('connection')) {
        return 'Connection issue. Check your internet and try again.';
    }
    if (lower.includes('size') || lower.includes('large')) {
        return 'This file is too large. Try a smaller file (under 10MB).';
    }

    return 'Something went wrong. Please try a different file or try again later.';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    starContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    glow: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: Colors.aurora.green,
    },
    star: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.aurora.card,
        borderWidth: 2,
        borderColor: Colors.aurora.green + '60',
        alignItems: 'center',
        justifyContent: 'center',
    },
    starIcon: {
        fontSize: 40,
        color: Colors.aurora.green,
    },
    stageContainer: {
        marginBottom: 24,
    },
    stageLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.aurora.text,
        textAlign: 'center',
    },
    progressContainer: {
        width: '100%',
        marginBottom: 16,
    },
    progressTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.aurora.green,
        borderRadius: 3,
    },
    progressText: {
        fontSize: 14,
        color: Colors.aurora.muted,
        textAlign: 'center',
    },
    timeContainer: {
        marginTop: 8,
    },
    timeMessage: {
        fontSize: 13,
        color: Colors.aurora.faint,
        textAlign: 'center',
    },
    errorContainer: {
        alignItems: 'center',
        padding: 24,
    },
    errorIcon: {
        marginBottom: 16,
    },
    errorIconText: {
        fontSize: 48,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.aurora.text,
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 15,
        color: Colors.aurora.muted,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    errorActions: {
        width: '100%',
        gap: 12,
    },
    retryButton: {
        backgroundColor: Colors.aurora.green,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    backButton: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    backButtonText: {
        color: Colors.aurora.muted,
        fontSize: 15,
    },
});
