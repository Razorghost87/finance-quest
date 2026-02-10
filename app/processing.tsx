import { ThemedText } from '@/components/themed-text';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarFlow } from '@/components/ui/StarFlow';
import { Colors } from '@/constants/theme';
import { getGuestToken } from '@/lib/guest-token';
import { useHybridProgress } from '@/lib/processing-progress';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

const BUILD_TAG = "PH1_UI_2026-02-08_r2";

/**
 * Stage labels for upload ritual (V2 Blueprint)
 * Frame as: "Updating North's understanding of you."
 */
const stageLabel = (s?: string) => {
  switch (s) {
    case 'queued':
      return 'Preparing your statement...';
    case 'starting':
      return 'Preparing your statement...';
    case 'downloading':
      return 'Reading your statement...';
    case 'extracting':
    case 'extracting_transactions':
      return 'Finding patterns...';
    case 'analyzing':
    case 'categorizing':
      return 'Finding patterns...';
    case 'saving':
    case 'saving_results':
      return 'Aligning your direction...';
    case 'retrying_openai':
      return 'Refining understanding...';
    case 'done':
      return 'Direction updated';
    default:
      return 'Understanding your finances...';
  }
};

export default function ProcessingScreen() {
  const params = useLocalSearchParams();
  const uploadId = params.uploadId as string;
  const fileName = (params.fileName as string) || 'statement';
  const [status, setStatus] = useState<'queued' | 'processing' | 'done' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dbProgress, setDbProgress] = useState<number>(0);
  const [dbStage, setDbStage] = useState<string>('starting');
  const [dbTraceId, setDbTraceId] = useState<string>('');
  const [etaHint, setEtaHint] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reconOk, setReconOk] = useState<boolean | null>(null);
  const [reconDelta, setReconDelta] = useState<number | null>(null);

  // Hybrid progress system (Steady visual movement synced with backend)
  const { displayProgress, stageLabel, timeMessage } = useHybridProgress({
    backendProgress: dbProgress,
    stage: dbStage,
    isDone: status === 'done',
    hasError: status === 'error',
  });

  useEffect(() => {
    if (!uploadId) {
      Alert.alert('Error', 'Missing upload ID');
      router.back();
      return;
    }

    const cleanupPromise = pollUploadStatus();
    return () => {
      Promise.resolve(cleanupPromise).then((cleanup) => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, [uploadId]);

  const pollUploadStatus = async () => {
    const supabase = ensureSupabaseConfigured();
    const guestToken = await getGuestToken();

    if (!guestToken) {
      setErrorMessage('Guest token not found');
      setStatus('error');
      return;
    }

    const startTime = Date.now();
    const timeout = 600000;
    let pollInterval = 1500;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;

      try {
        let upload: any = null;

        const { data: uploadData, error: pollError } = await supabase
          .from('upload')
          .select('status, error_message, progress, processing_stage, statement_extract_id, next_retry_at, last_error, trace_id')
          .eq('id', uploadId)
          .eq('guest_token', guestToken)
          .single();

        if (pollError) {
          console.error('Error polling status:', pollError);
          // Only stop on fatal non-transient errors
          if (pollError.code === 'PGRST116') {
            setErrorMessage('Upload record not found');
            setStatus('error');
            stopped = true;
          }
          return;
        }

        if (uploadData) {
          setStatus(uploadData.status as any);
          if (uploadData.processing_stage) setDbStage(uploadData.processing_stage);
          if (typeof uploadData.progress === 'number') setDbProgress(uploadData.progress);
          if (uploadData.trace_id) setDbTraceId(uploadData.trace_id);

          setEtaHint(timeMessage);

          // --- SELF-HEALING LOOP ---
          // If we've been polling for >3s and status is still "pending", 
          // it means the initial trigger was missed or failed. Re-trigger.
          const timeElapsed = Date.now() - startTime;
          if (uploadData.status === 'pending' && timeElapsed > 3000) {
            console.warn(`[${uploadId}] Still pending after 3s. Self-healing re-trigger...`);
            supabase.functions.invoke('parse-statement', {
              body: { upload_id: uploadId, guest_token: guestToken, trace_id: uploadData.trace_id },
            }).catch(e => console.error('Self-healing trigger failed:', e));
          }

          const nextRetryAt = (uploadData as any)?.next_retry_at ? new Date((uploadData as any).next_retry_at).getTime() : null;
          if ((uploadData as any)?.processing_stage === 'retrying_openai' && nextRetryAt && Date.now() >= nextRetryAt) {
            supabase.functions.invoke('parse-statement', {
              body: { upload_id: uploadId, guest_token: guestToken, trace_id: uploadData.trace_id },
            }).then((result: any) => {
              if (result.data?.job_id) {
                // Trigger worker to process the retry
                supabase.functions.invoke('process-job', {
                  body: { job_id: result.data.job_id },
                }).catch((err: any) => {
                  console.error('Worker trigger failed:', err);
                });
              }
            }).catch((err: any) => {
              console.error('Retry trigger failed:', err);
            });
          }

          if ((uploadData as any)?.processing_stage === 'queued') {
            supabase.functions.invoke('process-job', {
              body: { upload_id: uploadId },
            }).catch((err: any) => { });
          }

          if (uploadData.status === 'done') {
            try {
              if ((uploadData as any).statement_extract_id) {
                const { data: extract } = await supabase
                  .from('statement_extract')
                  .select('free_summary')
                  .eq('id', (uploadData as any).statement_extract_id)
                  .single();

                const fs = extract?.free_summary as any;
                setConfidence(typeof fs?.confidence?.score === 'number' ? fs.confidence.score : null);
                setReconOk(typeof fs?.reconciliation?.ok === 'boolean' ? fs.reconciliation.ok : null);
                setReconDelta(typeof fs?.reconciliation?.delta === 'number' ? fs.reconciliation.delta : null);
              }
            } catch { }

            stopped = true;
            router.replace({ pathname: '/results', params: { uploadId, fileName } });
            return;
          }

          if (uploadData.status === 'error') {
            stopped = true;
            let errorMsg = uploadData.error_message || 'Processing information unavailable';
            if (errorMsg.includes('502 Bad Gateway') || errorMsg.includes('<html>') || errorMsg.includes('502')) {
              errorMsg = 'Service momentarily paused. Retrying...';
            }
            setErrorMessage(errorMsg);
            setStatus('error');
            return;
          }
        }

        if (Date.now() - startTime > timeout) {
          setEtaHint('Still working... larger files need more time.');
          pollInterval = 4000;
        }
      } catch (e) {
        console.error('Polling error:', e);
        stopped = true;
        setErrorMessage(e instanceof Error ? e.message : 'Status check failed');
        setStatus('error');
      }
    };

    await tick();
    const id = setInterval(tick, pollInterval);

    return () => {
      stopped = true;
      clearInterval(id);
    };
  };

  const handleRetry = () => {
    router.back();
  };

  const handleDelete = async () => {
    try {
      const supabase = ensureSupabaseConfigured();
      const guestToken = await getGuestToken();

      if (!guestToken) {
        Alert.alert('Error', 'Guest token not found');
        return;
      }

      await supabase
        .from('upload')
        .delete()
        .eq('id', uploadId)
        .eq('guest_token', guestToken);

      router.back();
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Could not remove upload');
    }
  };

  if (status === 'error') {
    return (
      <AuroraBackground>
        <StarFlow intensity={1.5} />
        <View style={{ position: 'absolute', top: 44, left: 16, zIndex: 9999 }}>
          <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{BUILD_TAG}</ThemedText>
        </View>
        <View style={styles.container}>
          {/* Main Content Card */}
          <View style={styles.card}>
            <View style={styles.header}>
              <ActivityIndicator size="large" color={Colors.aurora.red} style={styles.spinner} />
              <ThemedText style={styles.statusText}>Processing Paused</ThemedText>
            </View>

            <ThemedText style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
              {fileName}
            </ThemedText>

            <View style={styles.progressSection}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: '100%', backgroundColor: Colors.aurora.red }]} />
              </View>
              <ThemedText style={styles.stageText}>
                Action required
              </ThemedText>
            </View>

            {etaHint && (
              <View style={styles.hintContainer}>
                <IconSymbol name="clock" size={12} color={Colors.aurora.muted} />
                <ThemedText style={styles.hintText}>{etaHint}</ThemedText>
              </View>
            )}

            {errorMessage && (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
                <Pressable onPress={handleRetry} style={styles.retryButton}>
                  <ThemedText style={styles.retryText}>Retry</ThemedText>
                </Pressable>
              </View>
            )}
          </View>

          <Pressable onPress={handleDelete} style={styles.cancelButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </Pressable>
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <StarFlow intensity={0.5 + (displayProgress / 100)} />
      <View style={{ position: 'absolute', top: 44, left: 16, zIndex: 9999 }}>
        <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{BUILD_TAG}</ThemedText>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.header}>
            <ActivityIndicator size="large" color={Colors.aurora.cyan} style={styles.spinner} />
            <ThemedText style={styles.statusText}>
              {status === 'queued' ? 'Queued' : status === 'processing' ? 'Processing' : 'Analyzing'}
            </ThemedText>
          </View>

          <ThemedText style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
            {fileName}
          </ThemedText>

          <View style={styles.progressSection}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${displayProgress}%` }]} />
            </View>
            <ThemedText style={styles.stageText}>
              {stageLabel}
            </ThemedText>
          </View>

          {etaHint && (
            <View style={styles.hintContainer}>
              <IconSymbol name="clock" size={12} color={Colors.aurora.muted} />
              <ThemedText style={styles.hintText}>{etaHint}</ThemedText>
            </View>
          )}

          {confidence != null && (
            <View style={styles.badgeRow}>
              {confidence != null && (
                <View style={styles.badge}>
                  <IconSymbol name="checkmark.shield.fill" size={12} color={Colors.aurora.green} style={{ marginRight: 4 }} />
                  <ThemedText style={styles.badgeText}>
                    Confidence {Math.round(confidence * 100)}%
                  </ThemedText>
                </View>
              )}

              {
                reconOk != null && (
                  <View style={[styles.badge, reconOk ? styles.badgeGood : styles.badgeBad]}>
                    <ThemedText style={styles.badgeText}>
                      {reconOk ? 'Reconciled' : `Diff Δ ${reconDelta ?? '?'}`}
                    </ThemedText>
                  </View>
                )
              }
            </View>
          )}

          {/* Trace ID for observability (subtle) */}
          <View style={{ marginTop: 24, opacity: 0.3 }}>
            <ThemedText style={{ fontSize: 10, color: Colors.aurora.muted }}>
              ID: {uploadId.substring(0, 8)} | TRACE: {dbTraceId || '---'}
            </ThemedText>
          </View>
        </View>
      </View>
    </AuroraBackground>
  );
}

// Added Layout Safety: Using standard padding and flex to avoid cropping
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60, // Safe padding for status bars
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
    gap: 16,
  },
  spinner: {
    transform: [{ scale: 1.5 }],
    marginBottom: 8,
  },
  statusText: {
    fontSize: 24,
    fontWeight: '300',
    color: Colors.aurora.text,
    letterSpacing: 1,
  },
  fileName: {
    fontSize: 14,
    color: Colors.aurora.muted,
    marginBottom: 40,
    maxWidth: '80%',
    textAlign: 'center',
  },
  progressSection: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.aurora.green,
    borderRadius: 999,
  },
  stageText: {
    fontSize: 13,
    color: Colors.aurora.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  hintText: {
    fontSize: 12,
    color: Colors.aurora.muted,
  },
  errorContainer: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
  errorText: {
    color: Colors.aurora.red,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: Colors.aurora.text,
  },
  cancelButton: {
    alignSelf: 'center',
    padding: 16,
  },
  cancelText: {
    color: Colors.aurora.muted,
    fontSize: 14,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 32,
    marginBottom: 12,
    color: Colors.aurora.text,
    letterSpacing: 0.5,
  },
  progressText: {
    fontSize: 48,
    fontWeight: '200',
    marginBottom: 24,
    color: Colors.aurora.green,
    letterSpacing: -1,
  },
  progressBarContainer: {
    width: '100%',
    maxWidth: 240,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.aurora.green,
    borderRadius: 2,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.aurora.muted,
    marginTop: 8,
  },
  // The original errorText is now replaced by the new one above.
  // errorText: {
  //   fontSize: 16,
  //   color: Colors.aurora.muted,
  //   textAlign: 'center',
  //   marginBottom: 32,
  //   paddingHorizontal: 24,
  // },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  deleteButton: {
    backgroundColor: 'rgba(255,77,77,0.1)',
    borderColor: 'rgba(255,77,77,0.3)',
  },
  buttonText: {
    color: Colors.aurora.text,
    fontSize: 15,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.aurora.muted,
  },
  badgeGood: {
    borderColor: 'rgba(56,255,179,0.3)',
    backgroundColor: 'rgba(56,255,179,0.05)',
  },
  badgeMid: {
    borderColor: 'rgba(255,176,32,0.3)',
  },
  badgeBad: {
    borderColor: 'rgba(255,77,77,0.3)',
  },
});
