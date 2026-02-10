import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';

export interface ConfidenceBadgeProps {
    score?: number; // 0.0 to 1.0
    grade?: 'high' | 'medium' | 'low';
    showLabel?: boolean;
    style?: ViewStyle;
}

export function ConfidenceBadge({ score, grade, showLabel = true, style }: ConfidenceBadgeProps) {
    // Determine grade if not provided
    const effectiveGrade = grade || (score !== undefined ? (score >= 0.85 ? 'high' : score >= 0.60 ? 'medium' : 'low') : 'medium');

    // Styles based on grade
    const badgeStyles = {
        high: styles.badgeHigh,
        medium: styles.badgeMedium,
        low: styles.badgeLow,
    };

    const textStyles = {
        high: styles.textHigh,
        medium: styles.textMedium,
        low: styles.textLow,
    };

    const labels = {
        high: 'High Confidence',
        medium: '~ Medium Confidence',
        low: '? Low Confidence',
    };

    const icons = {
        high: 'checkmark.circle.fill',
        medium: 'exclamationmark.triangle.fill',
        low: 'questionmark.circle.fill',
    } as const;

    return (
        <View style={[styles.badge, badgeStyles[effectiveGrade], style]}>
            {/* @ts-ignore icon symbol */}
            <IconSymbol
                name={icons[effectiveGrade]}
                size={14}
                color={effectiveGrade === 'high' ? Colors.aurora.green : effectiveGrade === 'medium' ? '#fbbf24' : '#f87171'}
            />
            {showLabel && (
                <ThemedText style={[styles.text, textStyles[effectiveGrade]]}>
                    {labels[effectiveGrade]}
                </ThemedText>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        gap: 6,
    },
    text: {
        fontSize: 12,
        fontWeight: '700',
    },

    // High
    badgeHigh: {
        borderColor: 'rgba(56, 255, 179, 0.3)',
        backgroundColor: 'rgba(56, 255, 179, 0.08)',
    },
    textHigh: {
        color: Colors.aurora.green,
    },

    // Medium
    badgeMedium: {
        borderColor: 'rgba(251, 191, 36, 0.3)',
        backgroundColor: 'rgba(251, 191, 36, 0.08)',
    },
    textMedium: {
        color: '#fbbf24',
    },

    // Low
    badgeLow: {
        borderColor: 'rgba(248, 113, 113, 0.3)',
        backgroundColor: 'rgba(248, 113, 113, 0.08)',
    },
    textLow: {
        color: '#f87171',
    },
});
