/**
 * Direction Verdict Component
 * 
 * The primary output of North.
 * Answers: "Am I okay financially... or not?"
 * 
 * Shows:
 * 1. Direction status (On Course / Drifting / Off Course)
 * 2. Confidence indicator
 * 3. Headline + Subtext (1-2 lines only)
 * 4. Primary cause (if relevant)
 */

import { Colors } from '@/constants/theme';
import {
    DirectionResult,
    getDirectionVisuals
} from '@/lib/direction-engine';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '../themed-text';

interface DirectionVerdictProps {
    result: DirectionResult;
    size?: 'compact' | 'full';
}

export function DirectionVerdict({ result, size = 'full' }: DirectionVerdictProps) {
    const visuals = getDirectionVisuals(result.status);

    // Pulse animation based on status
    const pulseScale = useSharedValue(1);
    const glowOpacity = useSharedValue(0.4);

    useEffect(() => {
        const duration = visuals.pulseSpeed === 'fast' ? 1000
            : visuals.pulseSpeed === 'medium' ? 1500
                : 2500;

        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        glowOpacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: duration / 2 }),
                withTiming(0.3, { duration: duration / 2 })
            ),
            -1,
            true
        );
    }, [visuals.pulseSpeed]);

    const starStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const isCompact = size === 'compact';

    return (
        <View style={[styles.container, isCompact && styles.containerCompact]}>
            {/* North Star Indicator */}
            <Animated.View entering={FadeIn.duration(300)} style={styles.starContainer}>
                <Animated.View style={[styles.starGlow, glowStyle, { backgroundColor: visuals.primaryColor }]} />
                <Animated.View style={[styles.star, starStyle]}>
                    <LinearGradient
                        colors={[visuals.primaryColor, visuals.secondaryColor]}
                        style={styles.starGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <ThemedText style={styles.starEmoji}>{visuals.emoji}</ThemedText>
                    </LinearGradient>
                </Animated.View>
            </Animated.View>

            {/* Status Label */}
            <Animated.View
                entering={FadeInDown.delay(100).duration(300)}
                style={styles.statusContainer}
            >
                <ThemedText style={[styles.statusLabel, { color: visuals.primaryColor }]}>
                    {visuals.label}
                </ThemedText>
            </Animated.View>

            {/* Headline */}
            <Animated.View
                entering={FadeInDown.delay(200).duration(300)}
                style={styles.headlineContainer}
            >
                <ThemedText style={[styles.headline, isCompact && styles.headlineCompact]}>
                    {result.headline}
                </ThemedText>
            </Animated.View>

            {/* Subtext */}
            <Animated.View
                entering={FadeInDown.delay(300).duration(300)}
                style={styles.subtextContainer}
            >
                <ThemedText style={styles.subtext}>
                    {result.subtext}
                </ThemedText>
            </Animated.View>

            {/* Confidence */}
            <Animated.View
                entering={FadeInDown.delay(400).duration(300)}
                style={styles.confidenceContainer}
            >
                <ConfidenceIndicator
                    score={result.confidence}
                    reason={result.confidenceReason}
                    compact={isCompact}
                />
            </Animated.View>

            {/* Primary Cause (if relevant) */}
            {result.primaryCause && !isCompact && (
                <Animated.View
                    entering={FadeInDown.delay(500).duration(300)}
                    style={styles.causeContainer}
                >
                    <View style={styles.causeCard}>
                        <ThemedText style={styles.causeLabel}>PRIMARY FACTOR</ThemedText>
                        <ThemedText style={styles.causeCategory}>
                            {result.primaryCause.category}
                        </ThemedText>
                        <ThemedText style={styles.causeImpact}>
                            {result.primaryCause.impact}
                        </ThemedText>
                        {result.primaryCause.suggestion && (
                            <ThemedText style={styles.causeSuggestion}>
                                {result.primaryCause.suggestion}
                            </ThemedText>
                        )}
                    </View>
                </Animated.View>
            )}
        </View>
    );
}

/**
 * Confidence Indicator
 */
function ConfidenceIndicator({
    score,
    reason,
    compact = false,
}: {
    score: number;
    reason: string;
    compact?: boolean;
}) {
    const barWidth = `${score}%`;

    // Color based on confidence level
    const barColor = score >= 70
        ? Colors.aurora.green
        : score >= 40
            ? Colors.aurora.yellow
            : Colors.aurora.red;

    return (
        <View style={[styles.confidence, compact && styles.confidenceCompact]}>
            <View style={styles.confidenceHeader}>
                <ThemedText style={styles.confidenceLabel}>
                    {compact ? 'Confidence' : 'Analysis Confidence'}
                </ThemedText>
                <ThemedText style={[styles.confidenceScore, { color: barColor }]}>
                    {score}%
                </ThemedText>
            </View>
            <View style={styles.confidenceBar}>
                <View style={[styles.confidenceFill, { width: `${score}%` as `${number}%`, backgroundColor: barColor }]} />
            </View>
            {!compact && (
                <ThemedText style={styles.confidenceReason}>{reason}</ThemedText>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    containerCompact: {
        paddingVertical: 16,
    },
    starContainer: {
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    starGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    star: {
        width: 80,
        height: 80,
        borderRadius: 40,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    starGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    starEmoji: {
        fontSize: 32,
    },
    statusContainer: {
        marginBottom: 8,
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    headlineContainer: {
        marginBottom: 8,
        paddingHorizontal: 24,
    },
    headline: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.aurora.text,
        textAlign: 'center',
        lineHeight: 32,
    },
    headlineCompact: {
        fontSize: 18,
        lineHeight: 24,
    },
    subtextContainer: {
        marginBottom: 20,
        paddingHorizontal: 24,
    },
    subtext: {
        fontSize: 15,
        color: Colors.aurora.muted,
        textAlign: 'center',
        lineHeight: 22,
    },
    confidenceContainer: {
        width: '100%',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    confidence: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    confidenceCompact: {
        padding: 12,
    },
    confidenceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    confidenceLabel: {
        fontSize: 12,
        color: Colors.aurora.muted,
        fontWeight: '600',
    },
    confidenceScore: {
        fontSize: 14,
        fontWeight: '700',
    },
    confidenceBar: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 8,
    },
    confidenceFill: {
        height: '100%',
        borderRadius: 2,
    },
    confidenceReason: {
        fontSize: 12,
        color: Colors.aurora.faint,
    },
    causeContainer: {
        width: '100%',
        paddingHorizontal: 24,
    },
    causeCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    causeLabel: {
        fontSize: 10,
        color: Colors.aurora.cyan,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    causeCategory: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.aurora.text,
        marginBottom: 4,
    },
    causeImpact: {
        fontSize: 14,
        color: Colors.aurora.muted,
        marginBottom: 6,
    },
    causeSuggestion: {
        fontSize: 13,
        color: Colors.aurora.green,
        fontStyle: 'italic',
    },
});
