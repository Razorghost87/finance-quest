/**
 * Month Snapshot Card - Quick stats for current month
 */
import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

interface MonthSnapshotProps {
    inflow: number;
    outflow: number;
    net: number;
    topCategory?: string;
    topCategoryAmount?: number;
}

export function MonthSnapshot({ inflow, outflow, net, topCategory, topCategoryAmount }: MonthSnapshotProps) {
    const formatMoney = (n: number) => `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    return (
        <View style={styles.container}>
            <ThemedText style={styles.title}>This Month</ThemedText>

            <View style={styles.grid}>
                <View style={styles.stat}>
                    <ThemedText style={styles.statLabel}>Inflow</ThemedText>
                    <ThemedText style={[styles.statValue, styles.positive]}>
                        +{formatMoney(inflow)}
                    </ThemedText>
                </View>

                <View style={styles.stat}>
                    <ThemedText style={styles.statLabel}>Outflow</ThemedText>
                    <ThemedText style={[styles.statValue, styles.negative]}>
                        -{formatMoney(outflow)}
                    </ThemedText>
                </View>

                <View style={styles.stat}>
                    <ThemedText style={styles.statLabel}>Net</ThemedText>
                    <ThemedText style={[
                        styles.statValue,
                        net >= 0 ? styles.positive : styles.negative
                    ]}>
                        {net >= 0 ? '+' : '-'}{formatMoney(net)}
                    </ThemedText>
                </View>

                {topCategory && (
                    <View style={styles.stat}>
                        <ThemedText style={styles.statLabel}>Top Spend</ThemedText>
                        <ThemedText style={styles.statValue} numberOfLines={1}>
                            {topCategory}
                        </ThemedText>
                        {topCategoryAmount && (
                            <ThemedText style={styles.statSub}>
                                {formatMoney(topCategoryAmount)}
                            </ThemedText>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.aurora.muted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    stat: {
        minWidth: '45%',
        flex: 1,
    },
    statLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.aurora.text,
    },
    statSub: {
        fontSize: 11,
        color: Colors.aurora.muted,
        marginTop: 2,
    },
    positive: {
        color: Colors.aurora.green,
    },
    negative: {
        color: Colors.aurora.red,
    },
});
