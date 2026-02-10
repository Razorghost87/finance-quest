// process-job/index.ts
// Background worker for processing PDF statements (async)

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import pdf from "npm:pdf-parse@1.1.1";
// @ts-ignore
import { Buffer } from "node:buffer";

// ----------------------------------------------------------------------
// TYPES & ENVIRONMENT
// ----------------------------------------------------------------------

interface DenoEnv {
  get(key: string): string | undefined;
}

declare const Deno: {
  env: DenoEnv;
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

// Environment variables
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_PROJECT_URL = Deno.env.get('SUPABASE_PROJECT_URL') || Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!OPENAI_API_KEY || !SUPABASE_PROJECT_URL || !SUPABASE_SERVICE_KEY) {
  console.error("CRITICAL: Missing required environment variables.");
}

// Setup Supabase client
const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_KEY);

interface JobBody {
  job_id: string; // The ID of the job to process
}

// ----------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------

// Day 2: Timeout guard - 90 seconds max per job
const JOB_TIMEOUT_MS = 90_000;

// Helper: Write debug event (non-blocking)
async function logDebug(
  traceId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  meta: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase.from('debug_events').insert({
      trace_id: traceId,
      source: 'process-job',
      level,
      message,
      meta,
    });
  } catch (e) {
    console.warn('[debug_events] Insert failed:', e);
  }
}

async function setUploadStage(
  upload_id: string,
  guest_token: string,
  stage: string,
  progress: number,
  extra: Record<string, any> = {}
) {
  await supabase
    .from("upload")
    .update({
      processing_stage: stage,
      progress,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", upload_id)
    .eq("guest_token", guest_token);
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
}

function encodeStoragePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function normalizeSignedUrl(url: string): string {
  if (!url) return url;
  if (url.includes("/storage/v1/object/")) return url;
  try {
    const u = new URL(url);
    const needsStoragePrefix = u.pathname.startsWith("/object/");
    if (!needsStoragePrefix) return url;
    const fixedPath = `/storage/v1${u.pathname}`;
    return `${u.origin}${fixedPath}${u.search}`;
  } catch {
    return url;
  }
}

async function downloadPdfFromStorage(bucket: string, filePath: string): Promise<Uint8Array> {
  const storagePathEncoded = encodeStoragePath(filePath);

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePathEncoded, 600);

  if (error) throw new Error(`createSignedUrl failed: ${error.message}`);
  if (!data?.signedUrl) throw new Error(`createSignedUrl returned no URL`);

  const urlToFetch = normalizeSignedUrl(data.signedUrl);

  const res = await fetch(urlToFetch);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);

  return new Uint8Array(await res.arrayBuffer());
}

async function extractPdfText(fileBytes: Uint8Array): Promise<string | null> {
  try {
    const buffer = Buffer.from(fileBytes);
    const data = await pdf(buffer);
    const text = data.text.trim();
    // If text is super short, it's probably a scan or empty
    if (text.length < 50) return null;
    return text;
  } catch (e) {
    console.warn("PDF extraction failed, falling back to OCR mode:", e);
    return null;
  }
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('base64');
}

async function uploadFileToOpenAI(pdfBytes: Uint8Array, fileName: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

  const form = new FormData();
  form.append('purpose', 'assistants');
  const arrayBuffer = pdfBytes.buffer instanceof ArrayBuffer
    ? pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
    : new Uint8Array(pdfBytes).buffer;
  form.append('file', new Blob([arrayBuffer as BlobPart], { type: 'application/pdf' }), fileName || 'statement.pdf');

  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) throw new Error(`OpenAI Files upload failed ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function deleteFileFromOpenAI(fileId: string): Promise<void> {
  if (!OPENAI_API_KEY) return;
  try {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    });
  } catch (e) {
    console.warn('Failed to delete OpenAI file', e);
  }
}

// OpenAI Responses API Helper
async function callOpenAIResponses(model: string, messages: any[]): Promise<any> {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  // Simple retry loop
  for (let i = 0; i < 3; i++) {
    try {
      // Create a controller to abort the request if it takes too long (120s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model,
          messages: messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "transactions_schema",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  opening_balance: { type: ["number", "null"], description: "The opening balance of the statement period" },
                  closing_balance: { type: ["number", "null"], description: "The closing balance of the statement period" },
                  transactions: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        date: { type: "string" },
                        description: { type: "string" },
                        amount: { type: "number" },
                        currency: { type: "string" },
                        category: {
                          type: "string",
                          enum: ["Food", "Transport", "Utilities", "Subscription", "Shopping", "Income", "Transfer", "Other"],
                          description: "Best guess category for this transaction"
                        },
                        balance: { type: ["number", "null"] }
                      },
                      required: ["date", "description", "amount", "currency", "category", "balance"]
                    }
                  }
                },
                required: ["opening_balance", "closing_balance", "transactions"]
              }
            }
          }
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status >= 500 || res.status === 429) {
          await new Promise(r => setTimeout(r, 2000 * (i + 1))); // Backoff
          continue;
        }
        const text = await res.text();
        throw new Error(`OpenAI failed ${res.status}: ${text}`);
      }
      return await res.json();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.error("OpenAI Request Timed Out (120s)");
        throw new Error("Analysis timed out (120s). The file may be too complex. Please try a simpler page.");
      }
      console.warn(`Attempt ${i + 1} failed:`, e);
      if (i === 2) throw e;
    }
  }
}

function parseOpenAIResponse(data: any): any {
  if (!data.choices?.[0]?.message?.content) {
    throw new Error("OpenAI returned empty content");
  }
  // Because we use STRICT JSON-Schema, we can trust JSON.parse
  // No regex magic needed.
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    throw new Error("Failed to parse OpenAI JSON output, even with Strict Mode.");
  }
}

// ----------------------------------------------------------------------
// MAIN WORKER LOGIC
// ----------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  let job_id: string;
  let reqTraceId: string | undefined;
  try {
    const body = await req.json();
    job_id = body.job_id;
    reqTraceId = body.trace_id; // Accept trace_id from request
  } catch {
    return new Response("Invalid Body", { status: 400 });
  }

  if (!job_id) return new Response("Missing job_id", { status: 400 });
  const traceIdForLog = reqTraceId || 'pre-flight-' + crypto.randomUUID().substring(0, 8);
  console.log(`[${traceIdForLog}] 🚀 Worker invoked for job ${job_id}`);
  console.log("process-job invoked", { job_id });

  const processJob = async () => {
    let uploadId = "";
    let guestTokenForCleanup = "";
    let openAIFileId = "";
    let messages: any[] = [];
    let traceId = reqTraceId || 'unknown';

    try {
      // 1. Fetch Job & Upload
      const { data: job } = await supabase.from('jobs').select('*').eq('id', job_id).single();
      if (!job) return;
      uploadId = job.upload_id;
      const { data: upload } = await supabase.from('upload').select('*').eq('id', uploadId).single();
      if (!upload) return;

      const guest_token = upload.guest_token;
      guestTokenForCleanup = guest_token;

      // Use trace_id from upload if not provided in request
      traceId = reqTraceId || upload.trace_id || crypto.randomUUID();
      console.log(`[${traceId}] Starting job processing`);

      await supabase.from("jobs").update({
        status: "processing",
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      // 📍 STEP 1.1 — Immediately mark upload as processing
      await setUploadStage(uploadId, guest_token, "starting", 5);

      // 📍 STEP 1.2 — Download stage
      await setUploadStage(uploadId, guest_token, "downloading", 15);

      // 2. Download File
      await logDebug(traceId, 'info', 'Stage: downloading', { file_path: upload.file_path });
      let dataBytes: Uint8Array;
      try {
        dataBytes = await downloadPdfFromStorage('uploads', upload.file_path);
        await logDebug(traceId, 'info', 'Download complete', { size: dataBytes.length });
      } catch (e: any) {
        console.error("Download failed:", e);
        await logDebug(traceId, 'error', 'Download failed', { error: e.message, stack: e.stack });
        await supabase.from('upload').update({ status: 'error', error_message: 'Failed to download file' }).eq('id', uploadId);
        return;
      }

      // 3. Determine Mode (Image vs PDF vs Text)
      const fileName = upload.file_name?.toLowerCase() || "";
      const isImage = fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
      const isPdf = fileName.endsWith('.pdf');

      if (isImage) {
        console.log("📸 Image detected, using Vision API");
        const base64 = arrayBufferToBase64(dataBytes);
        messages = [{
          role: 'user',
          content: [
            { type: 'text', text: "Extract all bank transactions from this statement. Output JSON. Rule: Debits negative, Credits positive. Date format YYYY-MM-DD. Currency 'SGD' default. Also extract opening_balance and closing_balance if visible." },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }];
        // 📍 STEP 1.2 — Extraction stage
        await supabase
          .from('upload')
          .update({
            processing_stage: 'extracting_transactions',
            progress: 40,
            updated_at: new Date().toISOString(),
          })
          .eq('id', uploadId);

      } else if (isPdf) {
        console.log("📄 PDF detected, attempting Text Extraction...");
        const extractedText = await extractPdfText(dataBytes);

        if (extractedText) {
          console.log("✅ Text extracted locally! (Length: " + extractedText.length + ")");
          messages = [{
            role: 'user',
            content: `Extract all bank transactions from this statement text. Output JSON. Rule: Debits negative, Credits positive. Date format YYYY-MM-DD. Currency 'SGD' default. Also extract opening_balance and closing_balance.
                        Categorize each transaction into: 'Food', 'Transport', 'Utilities', 'Subscription', 'Shopping', 'Income', 'Transfer', 'Other'.
                        
                        TEXT CONTENT:
                        ${extractedText.substring(0, 50000)}`
          }];
          // 📍 STEP 1.3 — Extraction stage
          await setUploadStage(uploadId, guest_token, "extracting_transactions", 45);
        } else {
          throw new Error("Could not extract text from PDF. Please upload an original digital PDF or converts pages to Images.");
        }
      } else {
        throw new Error("Unsupported file type");
      }

      // 4. Call GPT-4o-mini
      await logDebug(traceId, 'info', 'Stage: analyzing', { model: 'gpt-4o-mini' });

      // 📍 STEP 1.4 — Categorization stage
      await setUploadStage(uploadId, guest_token, "categorizing", 70);
      const resp = await callOpenAIResponses('gpt-4o-mini', messages);
      const parsed = parseOpenAIResponse(resp);
      await logDebug(traceId, 'info', 'OpenAI response parsed', { transactionCount: parsed.transactions?.length || 0 });
      const transactions = parsed.transactions || [];
      const openingBal = parsed.opening_balance || 0;
      const closingBal = parsed.closing_balance || 0;

      console.log(`✅ Extracted ${transactions.length} transactions`);
      await setUploadStage(uploadId, guest_token, "saving_results", 92);

      // 5. Calculate Metrics & Granular Confidence
      let totalIn = 0;
      let totalOut = 0;
      transactions.forEach((t: any) => {
        if (t.amount > 0) totalIn += t.amount;
        else totalOut += Math.abs(t.amount);
      });
      const net = totalIn - totalOut;

      // --- CONFIDENCE ENGINE ---
      const scores = {
        extraction: 0.95, // Assumed high if we got JSON
        reconciliation: 1.0,
        completeness: 1.0
      };
      const reasons: string[] = [];

      // Check 1: Reconciliation (Math Check)
      let delta = 0;
      if (openingBal != null && closingBal != null) {
        const calculatedClose = openingBal + net;
        delta = closingBal - calculatedClose;
        if (Math.abs(delta) > 0.1) {
          scores.reconciliation = Math.abs(delta) < 100 ? 0.7 : 0.4;
          reasons.push(`Reconciliation mismatch of $${delta.toFixed(2)}`);
        }
      } else {
        scores.reconciliation = 0.6; // No balances to check against
        reasons.push("Opening/Closing balances not found");
      }

      // Check 2: Data Completeness (Length/Gaps)
      // heuristic: processed vs extracted text length or empty fields
      if (transactions.length < 5) {
        scores.completeness = 0.8;
        reasons.push("Very few transactions found");
      }

      // Weighted Total Score
      const weightedScore = (scores.extraction * 0.3) + (scores.reconciliation * 0.5) + (scores.completeness * 0.2);
      let grade: 'high' | 'medium' | 'low' = 'high';
      if (weightedScore < 0.85) grade = 'medium';
      if (weightedScore < 0.60) grade = 'low';

      // Calculate Top Categories
      const catMap = new Map<string, number>();
      transactions.forEach((t: any) => {
        if (t.amount < 0) { // Expenses only
          const c = t.category || 'Other';
          catMap.set(c, (catMap.get(c) || 0) + Math.abs(t.amount));
        }
      });
      const topCategories = Array.from(catMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const summary = {
        period: "Statement Period", // TODO: Extract actual date range
        totals: {
          inflow: totalIn,
          outflow: totalOut,
          netCashflow: net
        },
        confidence: {
          score: weightedScore,
          grade: grade,
          reasons: reasons,
          details: scores
        },
        reconciliation: { ok: Math.abs(delta) < 0.1, delta: delta, opening: openingBal, closing: closingBal },
        topCategories: topCategories,
        insights: [`Extracted ${transactions.length} transactions`],
        flag: null,
        // North Star Metrics (Backend calculated)
        northStar: {
          label: "Savings Trajectory",
          value: net,
          trend: net > 0 ? 'up' : net < 0 ? 'down' : 'flat',
          subtitle: net > 0 ? "You are moving North" : "Drifting South"
        }
      };

      // 6. Save & Finish (IDEMPOTENT WRITE)

      // Step A: Clean up any existing extraction for this upload
      // This prevents duplicate transactions if the job runs multiple times or is retried.
      const { error: deletionError } = await supabase
        .from('statement_extract')
        .delete()
        .eq('upload_id', uploadId);

      if (deletionError) {
        console.warn("⚠️ Failed to clean up old extracts (non-fatal):", deletionError.message);
      }

      // Step B: Insert fresh extract
      const { data: extract, error: extractErr } = await supabase.from('statement_extract').insert({
        upload_id: uploadId,
        guest_token: upload.guest_token,
        free_summary: summary,
        confidence: weightedScore,
        reconciliation: summary.reconciliation
      }).select().single();

      if (extractErr) throw extractErr;

      // Step C: Batch insert transactions
      const limit = 500;
      for (let i = 0; i < transactions.length; i += limit) {
        const batch = transactions.slice(i, i + limit).map((t: any) => ({
          upload_id: uploadId,
          statement_extract_id: extract.id,
          guest_token: upload.guest_token,
          date: t.date,
          merchant: t.description, // Mapping description to merchant as requested
          description: t.description,
          amount: t.amount,
          currency: t.currency || 'SGD',
          category: t.category || 'Uncategorized'
        }));
        await supabase.from('transaction_extract').insert(batch);
      }

      // 📍 STEP 1.3 — SUCCESS (Write back extract ID)
      await supabase.from("upload").update({
        status: "done",
        progress: 100,
        processing_stage: "done",
        statement_extract_id: extract.id,
        updated_at: new Date().toISOString(),
      }).eq("id", uploadId).eq("guest_token", guestTokenForCleanup);

      await supabase.from('jobs').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', job_id);

      await logDebug(traceId, 'info', 'Job completed successfully', { extract_id: extract.id, transaction_count: transactions.length });
      console.log("🏁 Job completed successfully");

    } catch (e: any) {
      console.error("Processing failed:", e);
      await logDebug(traceId, 'error', 'Processing failed', { error: e.message, stack: e.stack });

      // 📍 STEP 1.4 — FAILURE
      await supabase
        .from('upload')
        .update({
          status: 'error',
          processing_stage: 'error',
          last_error: e.message,
          error_message: e.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadId)
        .eq('guest_token', guestTokenForCleanup);

      await supabase.from('jobs').update({ status: 'error', last_error: String(e) }).eq('id', job_id);
    } finally {
      if (openAIFileId) await deleteFileFromOpenAI(openAIFileId);
    }
  };

  // Day 2: Wrap processJob in timeout guard
  const processJobWithTimeout = async () => {
    try {
      await withTimeout(
        processJob(),
        JOB_TIMEOUT_MS,
        `Job timed out after ${JOB_TIMEOUT_MS / 1000}s. The file may be too complex.`
      );
    } catch (timeoutError: any) {
      console.error("Job timeout or fatal error:", timeoutError);
      // Try to update status even on timeout
      try {
        await supabase.from('upload').update({
          status: 'error',
          error_message: timeoutError.message || 'Job timed out'
        }).eq('id', job_id); // Use job_id as fallback
        await supabase.from('jobs').update({
          status: 'error',
          last_error: String(timeoutError)
        }).eq('id', job_id);
      } catch (updateErr) {
        console.error("Failed to update error state:", updateErr);
      }
    }
  };

  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(processJobWithTimeout());
  } else {
    processJobWithTimeout();
  }

  return new Response(JSON.stringify({ success: true, message: "Job started" }), { headers: { "Content-Type": "application/json" } });
});
