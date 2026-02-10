/**
 * Auros Tip - Simple financial coaching tips
 */
import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

interface AurosTipProps {
    tip: string;
    category?: string;
}

export function AurosTip({ tip, category }: AurosTipProps) {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(155,140,255,0.15)', 'rgba(79,209,255,0.08)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            />
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <ThemedText style={styles.icon}>💡</ThemedText>
                </View>
                <ThemedText style={styles.aurosLabel}>Auros</ThemedText>
                {category && <ThemedText style={styles.category}>{category}</ThemedText>}
            </View>
            <ThemedText style={styles.tipText}>{tip}</ThemedText>
        </View>
    );
}

/**
 * Generate Auros tips based on financial data
 * Hardcoded logic for v1 - simple rules
 */
export function generateAurosTips(data: {
    savingsRate: number;
    topCategory?: string;
    topCategoryAmount?: number;
    subscriptionTotal?: number;
    netCashflow: number;
}): string[] {
    const tips: string[] = [];

    // Savings rate tips
    if (data.savingsRate < 10) {
        tips.push('Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.');
    } else if (data.savingsRate >= 30) {
        tips.push('Keep it up! Consider investing your surplus for long-term growth.');
    }

    // Category tips
    if (data.topCategory && data.topCategoryAmount) {
        if (data.topCategory.toLowerCase().includes('dining') ||
            data.topCategory.toLowerCase().includes('food')) {
            tips.push(`Dining out is your top expense. Cooking at home 2 more days/week could save ~$200/month.`);
        }
        if (data.topCategory.toLowerCase().includes('transfer')) {
            tips.push('Large transfers detected. Make sure these are intentional savings, not forgotten payments.');
        }
    }

    // Subscription tips
    if (data.subscriptionTotal && data.subscriptionTotal > 100) {
        tips.push(`Subscriptions total $${data.subscriptionTotal}/month. Review for unused services—the average person wastes $30/month on forgotten subscriptions.`);
    }

    // Negative month tip
    if (data.netCashflow < 0) {
        tips.push('Consider setting a weekly spending limit to get back on track next month.');
    }

    return tips.slice(0, 3);
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(155,140,255,0.2)',
        overflow: 'hidden',
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(155,140,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 12,
    },
    aurosLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.aurora.purple,
        letterSpacing: 0.5,
    },
    category: {
        fontSize: 10,
        color: Colors.aurora.muted,
        marginLeft: 'auto',
    },
    tipText: {
        fontSize: 14,
        color: Colors.aurora.text,
        lineHeight: 21,
    },
});
