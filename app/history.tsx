import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

interface HistoricalMonth {
    id: string;
    period: string; // "Jan 2026"
    net: number; // derived from net_cashflow
    income: number;
    expenses: number;
    confidence: number;
    trend: 'up' | 'down' | 'flat';
}

interface NorthStarMetricDB {
    id: string;
    user_id: string;
    period_end: string;
    net_cashflow: number;
    confidence_score: number;
    // other columns optional for this view
}

export default function HistoryScreen() {
    const [history, setHistory] = useState<HistoricalMonth[]>([]);
    const [loading, setLoading] = useState(true);
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const supabase = ensureSupabaseConfigured();

            // 1. Check User Status
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLocked(true); // Is Guest
                setLoading(false);
                return;
            }

            // 2. Check Premium Tier
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('tier')
                .eq('id', user.id)
                .single();

            if (!profile || profile.tier === 'free') {
                setLocked(true); // Is Free User
                setLoading(false);
                return;
            }

            // 3. Fetch Data
            const { data: extracts } = await supabase
                .from('north_star_metrics') // Use the metrics table for trends
                .select('*')
                .eq('user_id', user.id)
                .order('period_end', { ascending: false });

            if (extracts) {
                const mapped = (extracts as NorthStarMetricDB[]).map((m) => ({
                    id: m.id,
                    period: new Date(m.period_end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    net: m.net_cashflow,
                    income: 0, // TODO: Add to north_star_metrics or fetch from statement_extract
                    expenses: 0,
                    confidence: m.confidence_score,
                    trend: (m.net_cashflow > 0 ? 'up' : 'down') as 'up' | 'down' | 'flat'
                }));
                setHistory(mapped);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={styles.center}>
                <ActivityIndicator color={Colors.aurora.cyan} />
            </ThemedView>
        );
    }

    if (locked) {
        return (
            <ThemedView style={styles.container}>
                <View style={styles.lockOverlay}>
                    <View style={styles.lockIconGlow} />
                    <ThemedText type="title" style={styles.lockTitle}>History Locked</ThemedText>
                    <ThemedText style={styles.lockDesc}>
                        Unlock North Premium to see your financial trajectory over time.
                    </ThemedText>

                    <Pressable style={styles.unlockBtn} onPress={() => router.push('/paywall')}>
                        <ThemedText style={styles.unlockText}>Unlock Intelligence</ThemedText>
                    </Pressable>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="title">Trajectory</ThemedText>
                <ThemedText style={styles.subtitle}>Your financial history</ThemedText>
            </View>

            <FlatList
                data={history}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <View>
                            <ThemedText style={styles.period}>{item.period}</ThemedText>
                            <ConfidenceBadge score={item.confidence} showLabel={false} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                        </View>

                        <View style={styles.right}>
                            <ThemedText style={[styles.amount, item.net >= 0 ? styles.positive : styles.negative]}>
                                {item.net >= 0 ? '+' : ''}${Math.abs(item.net).toLocaleString()}
                            </ThemedText>
                            <ThemedText style={styles.trendLabel}>Net Cashflow</ThemedText>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <ThemedText style={styles.emptyText}>No history yet. Upload more statements!</ThemedText>
                    </View>
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.aurora.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.aurora.bg },
    header: { padding: 24, paddingTop: 60 },
    subtitle: { color: Colors.aurora.muted, fontSize: 16 },
    list: { padding: 24, gap: 16 },

    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.aurora.card,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.aurora.border,
    },
    period: { fontSize: 16, fontWeight: '700', color: Colors.aurora.text },
    right: { alignItems: 'flex-end' },
    amount: { fontSize: 20, fontWeight: '800' },
    positive: { color: Colors.aurora.green },
    negative: { color: Colors.aurora.red },
    trendLabel: { fontSize: 12, color: Colors.aurora.muted, marginTop: 2 },

    // Lock Screen
    lockOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    lockIconGlow: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: 'rgba(59,227,255,0.1)',
        marginBottom: 24
    },
    lockTitle: { marginBottom: 16 },
    lockDesc: { textAlign: 'center', color: Colors.aurora.muted, lineHeight: 24, marginBottom: 32 },
    unlockBtn: {
        backgroundColor: Colors.aurora.cyan,
        paddingVertical: 16, paddingHorizontal: 32,
        borderRadius: 999,
    },
    unlockText: { color: '#000', fontWeight: '700', fontSize: 16 },

    empty: { marginTop: 40, alignItems: 'center' },
    emptyText: { color: Colors.aurora.faint }
});
