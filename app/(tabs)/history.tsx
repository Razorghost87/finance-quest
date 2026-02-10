
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Colors } from '@/constants/theme';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

export default function HistoryScreen() {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [])
    );

    const loadHistory = async () => {
        try {
            const supabase = ensureSupabaseConfigured();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setLoading(false);
                return;
            }

            // Fetch processed statements linked to this user
            const { data, error } = await supabase
                .from('statement_extract')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistory(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <AuroraBackground>
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.aurora.cyan} />
                </View>
            </AuroraBackground>
        );
    }

    return (
        <AuroraBackground>
            <View style={styles.header}>
                <ThemedText type="title" style={styles.title}>Portfolio</ThemedText>
            </View>

            <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <ThemedText style={styles.emptyText}>No saved reports yet.</ThemedText>
                        <ThemedText style={styles.emptySubtext}>Upload a statement to get started.</ThemedText>
                    </View>
                }
                renderItem={({ item, index }) => {
                    const net = item.free_summary?.totals?.netCashflow ?? 0;
                    const isPositive = net >= 0;
                    const prevNet = history[index + 1]?.free_summary?.totals?.netCashflow ?? 0;
                    const trend = net > prevNet ? 'up' : net < prevNet ? 'down' : 'flat';
                    const month = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                    return (
                        <ThemedView style={styles.card}>
                            <View style={styles.cardContent}>
                                <ThemedText style={styles.monthLabel}>{month}</ThemedText>
                                <View style={styles.netRow}>
                                    <ThemedText style={[styles.netValue, isPositive ? styles.positive : styles.negative]}>
                                        {isPositive ? '+' : ''}{typeof net === 'number' ? `$${net.toLocaleString()}` : 'N/A'}
                                    </ThemedText>
                                    {trend !== 'flat' && (
                                        <ThemedText style={[styles.trendIcon, trend === 'up' ? styles.positive : styles.negative]}>
                                            {trend === 'up' ? '↑' : '↓'}
                                        </ThemedText>
                                    )}
                                </View>
                            </View>
                            <View style={[styles.badge, isPositive ? styles.badgeGood : styles.badgeBad]}>
                                <ThemedText style={[styles.badgeText, isPositive ? styles.positive : styles.negative]}>
                                    {isPositive ? 'Surplus' : 'Deficit'}
                                </ThemedText>
                            </View>
                        </ThemedView>
                    );
                }}
            />
        </AuroraBackground>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 24, paddingTop: 60 },
    title: { fontSize: 32, fontWeight: '800', color: Colors.aurora.text },
    list: { padding: 24, gap: 16 },
    card: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    cardContent: {
        flex: 1,
    },
    monthLabel: {
        color: Colors.aurora.muted,
        fontSize: 14,
        marginBottom: 4
    },
    netRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    netValue: {
        fontSize: 22,
        fontWeight: '700'
    },
    trendIcon: {
        fontSize: 16,
        fontWeight: '600',
    },
    positive: { color: Colors.aurora.green },
    negative: { color: Colors.aurora.red },
    badge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeGood: {
        backgroundColor: 'rgba(0,255,163,0.1)',
        borderColor: 'rgba(0,255,163,0.3)',
    },
    badgeBad: {
        backgroundColor: 'rgba(255,77,77,0.1)',
        borderColor: 'rgba(255,77,77,0.3)',
    },
    badgeText: { fontSize: 11, fontWeight: '700' },
    empty: { padding: 40, alignItems: 'center' },
    emptyText: { color: Colors.aurora.muted, fontSize: 16, marginBottom: 8 },
    emptySubtext: { color: Colors.aurora.faint, fontSize: 14 },
});
