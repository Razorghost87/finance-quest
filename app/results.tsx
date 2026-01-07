import { NorthStarCard } from '@/components/NorthStarCard';
import { SubscriptionsCard } from '@/components/SubscriptionsCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TrustPanel } from '@/components/TrustPanel';
import { getGuestToken } from '@/lib/guest-token';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

type Reconciliation = {
  ok: boolean | null;
  delta: number | null;
  opening?: number | null;
  closing?: number | null;
  expectedClosing?: number | null;
};

type NorthStar = {
  label: string; // e.g. "Savings"
  value: number; // e.g. -5665
  trend: 'up' | 'down' | 'flat';
  subtitle?: string; // e.g. "Aim: +$1,000 this month"
};

interface FreeSummary {
  period: string;
  totals: {
    inflow: number;
    outflow: number;     // should be positive number (absolute)
    netCashflow: number; // can be negative
  };
  topCategories: Array<{ name: string; amount: number }>; // amount positive
  insights: string[];
  flag: string | null;
  subscriptions?: Array<{
    merchant: string;
    amount: number;
    interval: string;
    confidence: number;
    nextExpectedDate?: string | null;
  }>;
  confidence?: {
    score: number;
    grade: 'high' | 'medium' | 'low';
    reasons: string[];
  };
  reconciliation?: Reconciliation & {
    confidence?: number;
  };
  // Legacy fields (for backward compatibility)
  confidence_score?: number; // 0..1
  northStar?: NorthStar;
}

function formatMoney(n: number) {
  const abs = Math.abs(n);
  return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatMoney2(n: number) {
  const abs = Math.abs(n);
  return `$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function ResultsScreen() {
  const params = useLocalSearchParams();
  const uploadId = params.uploadId as string;
  const fileName = (params.fileName as string) || 'statement';
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FreeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uploadId) fetchSummary();
    else {
      setError('Missing upload ID');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId]);

  const fetchSummary = async () => {
    try {
      const supabase = ensureSupabaseConfigured();
      const guestToken = await getGuestToken();
      if (!guestToken) throw new Error('Guest token not found');

      // Fetch by upload_id directly (most reliable)
      const { data: extract, error: extractError } = await supabase
        .from('statement_extract')
        .select('free_summary')
        .eq('upload_id', uploadId)
        .eq('guest_token', guestToken)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (extractError) throw new Error(`Failed to fetch summary: ${extractError.message}`);
      if (!extract?.free_summary) throw new Error('No summary data found');

      setSummary(extract.free_summary as FreeSummary);
    } catch (err) {
      console.error('Error fetching summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const ui = useMemo(() => {
    if (!summary) return null;

    const inflow = Number(summary.totals?.inflow || 0);
    const outflow = Number(summary.totals?.outflow || 0);
    const net = Number(summary.totals?.netCashflow || 0);

    const netIsPositive = net >= 0;

    // Confidence (optional) - prefer new structure, fallback to old
    const conf = summary.confidence?.score ?? (typeof summary.confidence_score === 'number' ? clamp01(summary.confidence_score) : null);

    // Reconciliation (optional)
    const recon = summary.reconciliation ?? null;

    // Category bars
    const cats = Array.isArray(summary.topCategories) ? summary.topCategories : [];
    const maxCat = cats.length ? Math.max(...cats.map(c => Number(c.amount || 0))) : 0;

    // Default North Star if backend doesn't send one:
    const northStar: NorthStar = summary.northStar ?? {
      label: 'Savings',
      value: net,
      trend: net > 0 ? 'up' : net < 0 ? 'down' : 'flat',
      subtitle: 'Your month\'s net cashflow',
    };

    return { inflow, outflow, net, netIsPositive, conf, recon, cats, maxCat, northStar };
  }, [summary]);

  const handleUnlockFullReport = () => router.push('/paywall');

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AURORA.cyan} />
          <ThemedText style={styles.loadingText}>Loading results...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !summary || !ui) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Error
          </ThemedText>
          <ThemedText style={styles.errorText}>
            {error || 'Failed to load results'}
          </ThemedText>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ThemedText style={styles.buttonText}>Go Back</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const netColorStyle = ui.netIsPositive ? styles.valueGood : styles.valueBad;
  const netSign = ui.net >= 0 ? '' : '-';

  return (
    <ThemedView style={styles.container}>
      {/* Aurora header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <ThemedText type="title" style={styles.title}>
              Free Report
            </ThemedText>
            <ThemedText style={styles.period}>{summary.period}</ThemedText>
          </View>

          {/* Quality pills */}
          <View style={styles.pills}>
            {ui.conf != null && (
              <View style={[styles.pill, ui.conf >= 0.75 ? styles.pillGood : ui.conf >= 0.5 ? styles.pillMid : styles.pillBad]}>
                <ThemedText style={styles.pillText}>
                  Confidence {Math.round(ui.conf * 100)}%
                </ThemedText>
              </View>
            )}

            {ui.recon?.ok != null && (
              <View style={[styles.pill, ui.recon.ok ? styles.pillGood : styles.pillBad]}>
                <ThemedText style={styles.pillText}>
                  {ui.recon.ok ? 'Reconciled' : `Recon Δ ${ui.recon.delta != null ? formatMoney2(ui.recon.delta) : '?'}`}
                </ThemedText>
              </View>
            )}
          </View>
        </View>

      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* North Star Card */}
        <NorthStarCard
          netCashflow={ui.net}
          confidence={summary.confidence}
          reconciliation={summary.reconciliation}
        />

        {/* Subscriptions & Commitments */}
        {summary.subscriptions && summary.subscriptions.length > 0 && (
          <SubscriptionsCard subscriptions={summary.subscriptions} />
        )}
        {/* Totals */}
        <ThemedView style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <ThemedText type="subtitle" style={styles.cardTitle}>Totals</ThemedText>
            <View style={styles.miniChip}>
              <ThemedText style={styles.miniChipText}>Monthly</ThemedText>
            </View>
          </View>

          <View style={styles.rows}>
            <Row label="Inflow" value={formatMoney(ui.inflow)} valueStyle={styles.valueGood} />
            <Row label="Outflow" value={formatMoney(ui.outflow)} valueStyle={styles.valueBad} />
            <Row
              label="Net"
              value={`${netSign}${formatMoney(ui.net)}`}
              valueStyle={netColorStyle}
              strong
            />
          </View>
        </ThemedView>

        {/* Spending Hotspots (Top Categories) */}
        {ui.cats.length > 0 && (
          <ThemedView style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <ThemedText type="subtitle" style={styles.cardTitle}>Spending Hotspots</ThemedText>
              <ThemedText style={styles.cardHint}>by spend</ThemedText>
            </View>

            <View style={{ marginTop: 6, gap: 12 }}>
              {ui.cats.map((c, idx) => {
                const amt = Number(c.amount || 0);
                const pct = ui.maxCat > 0 ? Math.max(0.08, Math.min(1, amt / ui.maxCat)) : 0.12;

                return (
                  <View key={`${c.name}_${idx}`} style={styles.catRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.catTop}>
                        <ThemedText style={styles.catName}>{c.name}</ThemedText>
                        <ThemedText style={styles.catAmount}>{formatMoney(amt)}</ThemedText>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </ThemedView>
        )}

        {/* Insights */}
        {summary.insights?.length > 0 && (
          <ThemedView style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <ThemedText type="subtitle" style={styles.cardTitle}>Insights</ThemedText>
              <ThemedText style={styles.cardHint}>high-level</ThemedText>
            </View>

            <View style={{ marginTop: 4 }}>
              {summary.insights.slice(0, 4).map((insight, index) => (
                <View key={index} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <ThemedText style={styles.insightText}>{insight}</ThemedText>
                </View>
              ))}
            </View>

            {/* Optional: show why low confidence */}
            {ui.conf != null && ui.conf < 0.75 && (
              <View style={styles.noticeBox}>
                <ThemedText style={styles.noticeTitle}>Accuracy note</ThemedText>
                <ThemedText style={styles.noticeText}>
                  This report is best-effort. If transactions are missing or misclassified, use "Full Report" to review line items.
                </ThemedText>
              </View>
            )}
          </ThemedView>
        )}

        {/* Flag */}
        {summary.flag && (
          <ThemedView style={styles.flagCard}>
            <ThemedText style={styles.flagText}>{summary.flag}</ThemedText>
          </ThemedView>
        )}

        {/* Trust Panel */}
        <TrustPanel confidence={summary.confidence} />

        {/* CTA */}
        <Pressable style={styles.unlockButton} onPress={handleUnlockFullReport}>
          <View style={styles.unlockGlow} />
          <ThemedText style={styles.unlockButtonText}>Unlock Full Report & Save</ThemedText>
        </Pressable>

        <View style={{ height: 18 }} />
      </ScrollView>
    </ThemedView>
  );
}

function Row({
  label,
  value,
  valueStyle,
  strong,
}: {
  label: string;
  value: string;
  valueStyle?: any;
  strong?: boolean;
}) {
  return (
    <View style={[styles.row, strong && styles.rowStrong]}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={[styles.rowValue, valueStyle, strong && { fontSize: 22 }]}>{value}</ThemedText>
    </View>
  );
}

// Aurora palette (no gradients needed; we fake aurora with layered glows)
const AURORA = {
  bg: '#05060A',
  card: '#0B0D14',
  border: 'rgba(255,255,255,0.08)',
  text: 'rgba(255,255,255,0.92)',
  muted: 'rgba(255,255,255,0.65)',
  faint: 'rgba(255,255,255,0.45)',
  cyan: '#3BE3FF',
  green: '#38FFB3',
  purple: '#A78BFA',
  red: '#FF4D4D',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AURORA.bg,
  },

  header: {
    padding: 22,
    paddingTop: 58,
    borderBottomWidth: 1,
    borderBottomColor: AURORA.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: AURORA.text,
  },
  period: {
    marginTop: 6,
    fontSize: 15,
    color: AURORA.muted,
  },

  pills: {
    alignItems: 'flex-end',
    gap: 8,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: AURORA.text,
    opacity: 0.9,
  },
  pillGood: { borderColor: 'rgba(56,255,179,0.55)' },
  pillMid: { borderColor: 'rgba(59,227,255,0.45)' },
  pillBad: { borderColor: 'rgba(255,77,77,0.55)' },

  northStarCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AURORA.border,
    backgroundColor: AURORA.card,
    overflow: 'hidden',
    padding: 18,
  },
  northStarGlow: {
    position: 'absolute',
    top: -40,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(59,227,255,0.14)',
  },
  northStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  northStarLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: AURORA.faint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  northStarValue: {
    marginTop: 6,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: AURORA.text,
  },
  northStarSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: AURORA.muted,
  },
  northStarBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: 'rgba(167,139,250,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  northStarBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: AURORA.text,
    opacity: 0.9,
    letterSpacing: 0.6,
  },

  scrollView: { flex: 1 },
  scrollContent: {
    padding: 22,
    gap: 14,
  },

  card: {
    backgroundColor: AURORA.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: AURORA.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AURORA.text,
  },
  cardHint: {
    fontSize: 13,
    color: AURORA.muted,
  },

  miniChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59,227,255,0.35)',
    backgroundColor: 'rgba(59,227,255,0.06)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  miniChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: AURORA.text,
    opacity: 0.85,
  },

  rows: { marginTop: 10, gap: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowStrong: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AURORA.border,
    marginTop: 2,
  },
  rowLabel: {
    fontSize: 15,
    color: AURORA.muted,
  },
  rowValue: {
    fontSize: 20,
    fontWeight: '800',
    color: AURORA.text,
  },

  valueGood: { color: AURORA.green },
  valueBad: { color: AURORA.red },

  catRow: {
    paddingVertical: 2,
  },
  catTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
    color: AURORA.text,
  },
  catAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: AURORA.text,
    opacity: 0.9,
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(59,227,255,0.65)',
  },

  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 10,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    marginTop: 8,
    backgroundColor: 'rgba(56,255,179,0.85)',
  },
  insightText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: AURORA.text,
    opacity: 0.9,
  },

  noticeBox: {
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: AURORA.text,
    marginBottom: 6,
    opacity: 0.9,
  },
  noticeText: {
    fontSize: 13,
    color: AURORA.muted,
    lineHeight: 19,
  },

  flagCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.35)',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  flagText: {
    fontSize: 14,
    fontWeight: '800',
    color: AURORA.red,
  },

  unlockButton: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,227,255,0.35)',
    backgroundColor: 'rgba(59,227,255,0.10)',
    marginTop: 6,
  },
  unlockGlow: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 200,
    backgroundColor: 'rgba(56,255,179,0.16)',
  },
  unlockButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: AURORA.text,
    letterSpacing: 0.2,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: AURORA.muted },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: {
    fontSize: 16,
    color: AURORA.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: 'rgba(59,227,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,227,255,0.35)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  buttonText: { color: AURORA.text, fontSize: 16, fontWeight: '800' },
});
