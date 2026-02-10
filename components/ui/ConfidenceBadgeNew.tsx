/**
 * Confidence Badge - Shows trust level for analysis
 * 🟢 High / 🟡 Medium / 🔴 Low
 */
import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

interface ConfidenceData {
    score: number; // 0-1
    grade: 'high' | 'medium' | 'low';
    reasons?: string[];
}

interface ConfidenceBadgeProps {
    confidence: ConfidenceData | null | undefined;
    showScore?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export function ConfidenceBadgeNew({
    confidence,
    showScore = false,
    size = 'medium'
}: ConfidenceBadgeProps) {
    if (!confidence) {
        return (
            <View style={[styles.badge, styles.badgeUnknown, styles[size]]}>
                <ThemedText style={[styles.icon, styles[`${size}Text`]]}>⚪</ThemedText>
                <ThemedText style={[styles.label, styles[`${size}Text`]]}>Unknown</ThemedText>
            </View>
        );
    }

    const { score, grade } = confidence;

    const config = {
        high: { icon: '🟢', label: 'High Confidence', color: Colors.aurora.green },
        medium: { icon: '🟡', label: 'Medium', color: Colors.aurora.yellow },
        low: { icon: '🔴', label: 'Low Confidence', color: Colors.aurora.red },
    };

    const { icon, label, color } = config[grade] || config.medium;

    return (
        <View style={[styles.badge, { borderColor: color }, styles[size]]}>
            <ThemedText style={[styles.icon, styles[`${size}Text`]]}>{icon}</ThemedText>
            <ThemedText style={[styles.label, styles[`${size}Text`], { color }]}>
                {label}
                {showScore && ` (${Math.round(score * 100)}%)`}
            </ThemedText>
        </View>
    );
}

// Reconciliation indicator
interface ReconciliationProps {
    ok: boolean | null | undefined;
    delta?: number | null;
}

export function ReconciliationBadge({ ok, delta }: ReconciliationProps) {
    if (ok === null || ok === undefined) {
        return (
            <View style={[styles.reconBadge, styles.reconUnknown]}>
                <ThemedText style={styles.reconText}>⚪ Not Verified</ThemedText>
            </View>
        );
    }

    if (ok) {
        return (
            <View style={[styles.reconBadge, styles.reconOk]}>
                <ThemedText style={styles.reconText}>✅ Reconciled</ThemedText>
            </View>
        );
    }

    return (
        <View style={[styles.reconBadge, styles.reconWarning]}>
            <ThemedText style={styles.reconText}>
                ⚠️ Mismatch {delta != null ? `($${Math.abs(delta).toFixed(2)})` : ''}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        gap: 6,
    },
    badgeUnknown: {
        borderColor: 'rgba(255,255,255,0.2)',
    },
    small: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    medium: {},
    large: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    smallText: {
        fontSize: 10,
    },
    mediumText: {
        fontSize: 12,
    },
    largeText: {
        fontSize: 14,
    },
    icon: {
        fontSize: 12,
    },
    label: {
        fontWeight: '600',
        color: Colors.aurora.text,
    },
    reconBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    reconOk: {
        backgroundColor: 'rgba(52, 245, 197, 0.15)',
    },
    reconWarning: {
        backgroundColor: 'rgba(255, 193, 7, 0.15)',
    },
    reconUnknown: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    reconText: {
        fontSize: 11,
        fontWeight: '500',
        color: Colors.aurora.text,
    },
});
