import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getGuestToken } from '@/lib/guest-token';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

const stageLabel = (s?: string) => {
  switch (s) {
    case 'starting': return 'Starting…';
    case 'downloading': return 'Downloading statement…';
    case 'extracting_transactions': return 'Extracting transactions…';
    case 'categorizing': return 'Categorizing spending…';
    case 'saving_results': return 'Saving results…';
    case 'retrying_openai': return 'OpenAI is busy — retrying…';
    case 'done': return 'Done';
    default: return 'Analyzing your statement…';
  }
};

// Helper to detect missing column errors
const isMissingColumnError = (err: any) =>
  (err?.code === '42703') ||
  (typeof err?.message === 'string' && err.message.includes('does not exist'));

export default function ProcessingScreen() {
  const params = useLocalSearchParams();
  const uploadId = params.uploadId as string;
  const fileName = (params.fileName as string) || 'statement';
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);            // 0..100 from backend if available
  const [stage, setStage] = useState<string>('starting');        // backend stage string
  const [etaHint, setEtaHint] = useState<string>('');             // optional UX text
  const [confidence, setConfidence] = useState<number | null>(null); // 0..1
  const [reconOk, setReconOk] = useState<boolean | null>(null);      // reconciliation ok?
  const [reconDelta, setReconDelta] = useState<number | null>(null); // reconciliation delta

  useEffect(() => {
    if (!uploadId) {
      Alert.alert('Error', 'Missing upload ID');
      router.back();
      return;
    }

    const cleanupPromise = pollUploadStatus();
    return () => {
      // pollUploadStatus returns a cleanup function (or undefined) via async
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
    const timeout = 600000; // 10 minutes (was 3 minutes)
    let pollInterval = 1500; // Start with 1.5s, slow down if timeout exceeded

    let stopped = false;

    const tick = async () => {
      if (stopped) return;

      try {
        let upload: any = null;

        // Try "new schema" first (with progress/stage columns)
        let res = await supabase
          .from('upload')
          .select('status, error_message, progress, processing_stage, statement_extract_id, next_retry_at, last_error')
          .eq('id', uploadId)
          .eq('guest_token', guestToken)
          .single();

        // Check if error is due to missing columns (PostgreSQL error code 42703)
        // FIX: More robust error detection for missing columns
        const isColumnError = res.error && (
          res.error.code === '42703' || // PostgreSQL: undefined_column
          res.error.code === 'PGRST116' || // PostgREST: column not found
          (typeof res.error.message === 'string' && (
            res.error.message.includes('column') && res.error.message.includes('does not exist') ||
            res.error.message.includes('progress') ||
            res.error.message.includes('processing_stage') ||
            res.error.message.includes('statement_extract_id') ||
            res.error.message.includes('next_retry_at') ||
            res.error.message.includes('last_error')
          ))
        );
        
        if (isColumnError) {
          // Fallback to old schema (no progress/stage columns)
          console.warn('⚠️ Missing progress columns, using fallback query');
          try {
            res = await supabase
              .from('upload')
              .select('status, error_message, statement_extract_id')
              .eq('id', uploadId)
              .eq('guest_token', guestToken)
              .single();
          } catch (fallbackError) {
            // If fallback also fails, try minimal query
            console.warn('⚠️ Fallback query failed, trying minimal query');
            res = await supabase
              .from('upload')
              .select('status, error_message')
              .eq('id', uploadId)
              .eq('guest_token', guestToken)
              .single();
          }
        }

        if (res.error) {
          console.error('Error polling status:', res.error);
          return;
        }

        upload = res.data;

        if (upload) {
          setStatus(upload.status as any);

          // Guard safely when reading stage/progress
          const dbStage =
            typeof upload?.processing_stage === 'string' ? upload.processing_stage : null;

          const dbProgress =
            typeof upload?.progress === 'number' && Number.isFinite(upload.progress)
              ? upload.progress
              : null;

          if (dbStage) setStage(dbStage);
          
          if (dbProgress != null) {
            setProgress(Math.min(100, Math.max(0, dbProgress)));
          } else {
            // Fallback: simulate progress
            const elapsed = Date.now() - startTime;
            setProgress(Math.min(90, (elapsed / timeout) * 100));
            if (!dbStage) {
              if (elapsed < 4000) setStage('starting');
              else if (elapsed < 12000) setStage('downloading');
              else if (elapsed < 30000) setStage('extracting_transactions');
              else if (elapsed < 60000) setStage('categorizing');
              else setStage('saving_results');
            }
          }

          setEtaHint(dbStage ? '' : 'This can take ~10–30 seconds for PDFs');

          // Trigger retry if scheduled and time has come (only if columns exist)
          const nextRetryAt = (upload as any)?.next_retry_at ? new Date((upload as any).next_retry_at).getTime() : null;
          if ((upload as any)?.processing_stage === 'retrying_openai' && nextRetryAt && Date.now() >= nextRetryAt) {
            // Trigger retry (idempotent) - re-enqueue job
            console.log('🔄 Triggering scheduled retry...');
            supabase.functions.invoke('parse-statement', {
              body: { upload_id: uploadId, guest_token: guestToken },
            }).then((result) => {
              if (result.data?.job_id) {
                // Trigger worker to process the retry
                supabase.functions.invoke('process-job', {
                  body: { job_id: result.data.job_id },
                }).catch((err) => {
                  console.error('Worker trigger failed:', err);
                });
              }
            }).catch((err) => {
              console.error('Retry trigger failed:', err);
            });
          }
          
          // If job is queued but no worker running, trigger it
          if ((upload as any)?.processing_stage === 'queued') {
            // Try to find and process the job
            supabase.functions.invoke('process-job', {
              body: { upload_id: uploadId },
            }).catch((err) => {
              // Ignore errors - worker might be busy or job already processing
            });
          }

          if (upload.status === 'done') {
            // Optional prefetch confidence/recon
            try {
              if ((upload as any).statement_extract_id) {
                const { data: extract } = await supabase
                  .from('statement_extract')
                  .select('free_summary')
                  .eq('id', (upload as any).statement_extract_id)
                  .single();

                const fs = extract?.free_summary as any;
                setConfidence(typeof fs?.confidence?.score === 'number' ? fs.confidence.score : null);
                setReconOk(typeof fs?.reconciliation?.ok === 'boolean' ? fs.reconciliation.ok : null);
                setReconDelta(typeof fs?.reconciliation?.delta === 'number' ? fs.reconciliation.delta : null);
              }
            } catch {}

            stopped = true;
            router.replace({ pathname: '/results', params: { uploadId, fileName } });
            return;
          }

          if (upload.status === 'error') {
            stopped = true;
            // Show friendly message for 502/transient errors
            let errorMsg = upload.error_message || 'Processing failed';
            if (errorMsg.includes('502 Bad Gateway') || errorMsg.includes('<html>') || errorMsg.includes('502')) {
              errorMsg = 'Service temporarily unavailable. Retrying automatically.';
            }
            setErrorMessage(errorMsg);
            setStatus('error');
            return;
          }
        }

        // Timeout check - don't hard-fail if backend still shows processing
        if (Date.now() - startTime > timeout) {
          // DO NOT hard-fail if backend still shows processing
          setEtaHint('Still working… this can take a few minutes for larger PDFs.');
          // Slow down polling but keep going
          pollInterval = 4000;
          // Don't return - keep polling
        }
      } catch (e) {
        console.error('Polling error:', e);
        stopped = true;
        setErrorMessage(e instanceof Error ? e.message : 'Failed to check status');
        setStatus('error');
      }
    };

    // immediate tick + interval
    await tick();
    const id = setInterval(tick, pollInterval);

    // cleanup on unmount
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

      // Delete upload record
      await supabase
        .from('upload')
        .delete()
        .eq('id', uploadId)
        .eq('guest_token', guestToken);

      router.back();
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Failed to delete upload');
    }
  };

  if (status === 'error') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            Processing Error
          </ThemedText>
          <ThemedText style={styles.errorText}>
            {errorMessage || 'An error occurred while processing your statement.'}
          </ThemedText>
          <View style={styles.buttonContainer}>
            <View style={styles.buttonRow}>
              <Pressable style={styles.button} onPress={handleRetry}>
                <ThemedText style={styles.buttonText}>Retry</ThemedText>
              </Pressable>
              <Pressable style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
                <ThemedText style={styles.buttonText}>Delete</ThemedText>
              </Pressable>
            </View>
            <Pressable 
              style={[styles.button, styles.debugButton]} 
              onPress={() => Alert.alert('Debug Info', `Upload ID: ${uploadId}\nStage: ${stage}\nProgress: ${Math.round(progress)}%`)}
            >
              <ThemedText style={styles.buttonText}>View Debug Info</ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText type="subtitle" style={styles.title}>
          {stageLabel(stage) || 'Processing…'}
        </ThemedText>

        <ThemedText style={styles.progressText}>
          {Math.round(progress)}%
        </ThemedText>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>

        <View style={{ marginTop: 10, alignItems: 'center' }}>
          {!!etaHint && (
            <ThemedText style={styles.subtitle}>
              {etaHint}
            </ThemedText>
          )}

          {/* Confidence + recon preview (if backend already computed early) */}
          {(confidence != null || reconOk != null) && (
            <View style={styles.badgeRow}>
              {confidence != null && (
                <View style={[styles.badge, confidence >= 0.75 ? styles.badgeGood : confidence >= 0.5 ? styles.badgeMid : styles.badgeBad]}>
                  <ThemedText style={styles.badgeText}>
                    Confidence {Math.round(confidence * 100)}%
                  </ThemedText>
                </View>
              )}

              {reconOk != null && (
                <View style={[styles.badge, reconOk ? styles.badgeGood : styles.badgeBad]}>
                  <ThemedText style={styles.badgeText}>
                    {reconOk ? 'Reconciled' : `Recon Δ ${reconDelta ?? '?'}`}
                  </ThemedText>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    color: '#007AFF',
  },
  progressBarContainer: {
    width: '80%',
    maxWidth: 300,
    height: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  debugButton: {
    marginTop: 12,
    backgroundColor: '#333333',
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#111',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
  badgeGood: {
    borderColor: '#1f3',
  },
  badgeMid: {
    borderColor: '#ffb020',
  },
  badgeBad: {
    borderColor: '#ff3b30',
  },
});
