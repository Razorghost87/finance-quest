/**
 * Savings Rate Ring - Visual progress indicator
 * Color coding: red <10%, yellow 10-30%, green 30%+
 */
import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

interface SavingsRateRingProps {
    /** Savings rate as percentage (0-100) */
    rate: number;
    /** Size of the ring */
    size?: number;
}

export function SavingsRateRing({
    rate,
    size = 120,
}: SavingsRateRingProps) {
    // Clamp rate between 0 and 100
    const clampedRate = Math.max(0, Math.min(100, rate));

    // Color based on rate
    const getColor = () => {
        if (clampedRate < 10) return Colors.aurora.red;
        if (clampedRate < 30) return '#FFC107'; // Yellow (amber)
        return Colors.aurora.green;
    };

    // Grade label
    const getGrade = () => {
        if (clampedRate < 10) return 'At Risk';
        if (clampedRate < 30) return 'Building';
        return 'Strong';
    };

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {/* Background ring */}
            <View style={[styles.ring, {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: 'rgba(255,255,255,0.1)',
            }]} />

            {/* Progress indicator (simplified arc representation) */}
            <View style={[styles.progressBg, {
                width: size - 24,
                height: size - 24,
                borderRadius: (size - 24) / 2,
                borderColor: getColor(),
                borderWidth: 8,
                opacity: 0.3 + (clampedRate / 100) * 0.7,
            }]} />

            {/* Center content */}
            <View style={styles.labelContainer}>
                <ThemedText style={[styles.rateText, { color: getColor() }]}>
                    {Math.round(clampedRate)}%
                </ThemedText>
                <ThemedText style={styles.gradeText}>{getGrade()}</ThemedText>
                <ThemedText style={styles.labelText}>Savings Rate</ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    ring: {
        position: 'absolute',
        borderWidth: 8,
    },
    progressBg: {
        position: 'absolute',
    },
    labelContainer: {
        alignItems: 'center',
    },
    rateText: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -1,
    },
    gradeText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.aurora.muted,
        marginTop: 2,
    },
    labelText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 4,
    },
});
