// Using Deno.serve directly (no std import to avoid Node compatibility issues)
/// <reference path="../deno.d.ts" />
// @ts-ignore - ESM imports work in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
// Use custom names if set, otherwise fall back to Supabase-provided env vars
const SUPABASE_PROJECT_URL = Deno.env.get('SUPABASE_PROJECT_URL') || Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create Supabase client for storage operations
const supabaseStorage = createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_KEY);

/**
 * Encode storage path preserving slashes (Supabase Storage requires hierarchical paths)
 */
function encodeStoragePath(path: string): string {
  // Preserve `/` separators but encode each segment
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Join base URL with path, handling absolute/relative paths correctly
 */
function joinUrl(base: string, pathOrUrl: string): string {
  // If it's already absolute, return as-is
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const b = base.replace(/\/+$/, "");
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
}

/**
 * Normalize signed URL to ensure it includes /storage/v1/object/ path
 */
function normalizeSignedUrl(url: string): string {
  if (!url) return url;

  // Already correct
  if (url.includes("/storage/v1/object/")) return url;

  try {
    const u = new URL(url);
    const needsStoragePrefix = u.pathname.startsWith("/object/");
    if (!needsStoragePrefix) return url;

    // Convert:
    // https://PROJECT.supabase.co/object/sign/... -> https://PROJECT.supabase.co/storage/v1/object/sign/...
    const fixedPath = `/storage/v1${u.pathname}`;
    return `${u.origin}${fixedPath}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Extract JSON from model output, handling markdown code fences and extra text
 */
function extractJson(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new Error('Input is not a valid string');
  }

  // 1) Remove ```json and ``` fences if present
  let cleaned = text.replace(/```(?:json)?/gi, '').trim();

  // 2) Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to extraction
  }

  // 3) Extract first JSON object/array substring
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    // Both found, use the one that comes first
    start = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }

  if (start === -1) {
    throw new Error(`No JSON found in model output. First 200 chars: ${text.slice(0, 200)}`);
  }

  // Find the matching closing brace/bracket
  const candidate = cleaned.slice(start);
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let end = -1;

  for (let i = 0; i < candidate.length; i++) {
    const char = candidate[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (inString) continue;
    
    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Unclosed JSON in model output. First 500 chars: ${text.slice(0, 500)}`);
  }

  const jsonString = candidate.slice(0, end);
  
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Failed to parse extracted JSON: ${String(e)}. Extracted: ${jsonString.slice(0, 200)}`);
  }
}

/**
 * Supabase REST API helpers (pure fetch, no Node shims)
 */
async function supabaseFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${SUPABASE_PROJECT_URL}/rest/v1${endpoint}`;
  
  // Build headers - only set default Prefer if caller didn't set it
  const headers = new Headers(options.headers);
  if (!headers.has('Prefer')) {
    headers.set('Prefer', 'return=representation');
  }
  headers.set('apikey', SUPABASE_SERVICE_KEY);
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`);
  headers.set('Content-Type', 'application/json');
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase API error ${response.status}: ${text.slice(0, 400)}`);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  return await response.json();
}

async function supabaseSelect(table: string, filters: Record<string, any> = {}, options: { single?: boolean; orderBy?: string; ascending?: boolean } = {}): Promise<any> {
  const params = new URLSearchParams();
  
  // Add filters
  for (const [key, value] of Object.entries(filters)) {
    params.append(key, `eq.${value}`);
  }
  
  // Add ordering
  if (options.orderBy) {
    params.append('order', `${options.orderBy}.${options.ascending !== false ? 'asc' : 'desc'}`);
  }
  
  // Add select
  params.append('select', '*');
  
  const endpoint = `/${table}?${params.toString()}`;
  const data = await supabaseFetch(endpoint);
  
  if (options.single) {
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }
  
  return data;
}

async function supabaseInsert(table: string, data: any, options: { single?: boolean } = {}): Promise<any> {
  const endpoint = `/${table}`;
  const result = await supabaseFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Prefer': options.single ? 'return=representation' : 'return=minimal',
    },
  });
  
  if (options.single && Array.isArray(result) && result.length > 0) {
    return result[0];
  }
  
  return result;
}

async function supabaseUpdate(table: string, data: any, filters: Record<string, any>): Promise<void> {
  const params = new URLSearchParams();
  
  for (const [key, value] of Object.entries(filters)) {
    params.append(key, `eq.${value}`);
  }
  
  const url = `${SUPABASE_PROJECT_URL}/rest/v1/${table}?${params.toString()}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase update failed: ${response.status} ${text}`);
  }
}

/**
 * Check if error is retryable OpenAI error
 */
function isRetryableOpenAIError(msg: string): boolean {
  return msg.includes('OpenAI Responses failed 502')
    || msg.includes('OpenAI Responses failed 503')
    || msg.includes('OpenAI Responses failed 504')
    || msg.includes('OpenAI Responses failed 429');
}

/**
 * Centralized upload row update (never stuck again)
 */
async function updateUpload(upload_id: string, patch: Record<string, any>) {
  try {
    await supabaseUpdate('upload', patch, { id: upload_id });
  } catch (error) {
    console.error('Failed to update upload row:', error);
  }
}

/**
 * Set stage and progress (simplified helper)
 */
async function setStage(upload_id: string, stage: string, progress: number) {
  await updateUpload(upload_id, {
    processing_stage: stage,
    progress: Math.max(0, Math.min(100, progress)),
    status: 'processing',
  });
}

/**
 * Download PDF from Supabase Storage using the client's createSignedUrl method
 * This avoids manual URL construction pitfalls
 */
async function downloadPdfFromStorage(bucket: string, filePath: string): Promise<Uint8Array> {
  // IMPORTANT: filePath must be the object key inside the bucket (no leading bucket name)
  const storagePathRaw = filePath;
  const storagePathEncoded = encodeStoragePath(filePath);
  
  // Validate path
  if (!storagePathRaw || storagePathRaw.includes("undefined")) {
    throw new Error(`Invalid storage path: ${storagePathRaw}`);
  }

  // Check for bucket prefix in path (common mistake)
  if (storagePathRaw.startsWith(`${bucket}/`)) {
    console.warn(
      "⚠️ file_path includes bucket prefix. It should be object key ONLY. file_path=",
      storagePathRaw
    );
  }

  console.log("🔎 Storage fetch path (raw):", storagePathRaw);
  console.log("🔎 Storage fetch path (encoded):", storagePathEncoded);

  // Use encoded path for signing (critical for paths with special characters, folders, etc.)
  const pathForSigning = storagePathEncoded;
  const { data, error } = await supabaseStorage.storage
    .from(bucket)
    .createSignedUrl(pathForSigning, 600);

  if (error) {
    throw new Error(`createSignedUrl failed: ${error.message}`);
  }
  if (!data?.signedUrl) {
    throw new Error(`createSignedUrl returned no URL`);
  }

  const signedUrl = data.signedUrl;
  console.log("signedUrl full:", signedUrl);

  const normalizedSignedUrl = normalizeSignedUrl(signedUrl);
  console.log("signedUrl normalized:", normalizedSignedUrl);

  const urlToFetch = normalizedSignedUrl;

  // HEAD check (quick "does this URL actually exist")
  try {
    const head = await fetch(urlToFetch, { method: "HEAD" });
    console.log("signedUrl HEAD status:", head.status, head.statusText);
  } catch (e) {
    console.log("signedUrl HEAD status: fetch_failed", String(e));
  }

  const res = await fetch(urlToFetch);
  console.log("signedUrl fetch status:", res.status, res.statusText);
  console.log("signedUrl content-type:", res.headers.get("content-type"));

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  console.log("✅ Downloaded PDF:", bytes.length, "bytes");
  return bytes;
}

async function supabaseStorageDownload(bucket: string, path: string): Promise<Blob> {
  // Encode path preserving slashes (critical for Supabase Storage)
  const encodedPath = encodeStoragePath(path);
  const endpoint = `/storage/v1/object/${bucket}/${encodedPath}`;
  const url = `${SUPABASE_PROJECT_URL}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase Storage download error ${response.status}: ${text.slice(0, 400)}`);
  }

  return await response.blob();
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Safely convert ArrayBuffer to base64 string
 * Processes in chunks to avoid call stack overflow with large files
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks to avoid call stack issues

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    // Convert chunk to array to avoid iteration issues
    const chunkArray = Array.from(chunk);
    binary += String.fromCharCode(...chunkArray);
  }

  return btoa(binary);
}

/**
 * Read text output from OpenAI Responses API robustly
 */
function readResponsesText(data: any): string {
  if (typeof data.output_text === 'string') return data.output_text;

  const chunks = data.output?.flatMap((o: any) => o.content ?? []) ?? [];

  const texts = chunks
    .map((c: any) => c.text ?? c?.content?.text ?? '')
    .filter(Boolean);

  return texts.join('');
}

/**
 * Upload file to OpenAI Files API using fetch (Edge-safe, no Node shims)
 */
async function uploadFileToOpenAI(pdfBytes: Uint8Array, fileName: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const form = new FormData();
  form.append('purpose', 'assistants');
  // Convert Uint8Array to ArrayBuffer for Blob (ensure it's ArrayBuffer, not SharedArrayBuffer)
  const arrayBuffer = pdfBytes.buffer instanceof ArrayBuffer 
    ? pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
    : new Uint8Array(pdfBytes).buffer;
  form.append('file', new Blob([arrayBuffer as BlobPart], { type: 'application/pdf' }), fileName || 'statement.pdf');

  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI Files upload failed ${res.status}: ${text.slice(0, 400)}`);

  const data = JSON.parse(text); // contains { id: "file-..." }
  return data.id;
}

/**
 * Delete file from OpenAI Files API using fetch
 */
async function deleteFileFromOpenAI(fileId: string): Promise<void> {
  if (!OPENAI_API_KEY) return;

  try {
    const response = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to delete OpenAI file ${fileId}: ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to cleanup OpenAI file:', error);
  }
}

/**
 * Check if HTTP status is retryable
 */
function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Sleep helper for backoff
 */
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Call OpenAI Responses API with retry logic (Edge-safe, no Node shims)
 */
async function callOpenAIResponses(body: any): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();

      if (!res.ok) {
        // retryable gateway errors (Cloudflare 502 etc)
        if (isRetryableStatus(res.status) && attempt < maxAttempts) {
          const backoff = Math.min(8000, 500 * Math.pow(2, attempt - 1));
          console.warn(`⚠️ OpenAI retryable error ${res.status} (attempt ${attempt}/${maxAttempts}). Backing off ${backoff}ms`);
          await sleep(backoff);
          continue;
        }

        // non-retryable
        throw new Error(`OpenAI Responses failed ${res.status}: ${text.slice(0, 600)}`);
      }

      return JSON.parse(text);
    } catch (err) {
      // network errors should retry
      if (attempt < maxAttempts) {
        const backoff = Math.min(8000, 500 * Math.pow(2, attempt - 1));
        console.warn(`⚠️ OpenAI network/error (attempt ${attempt}/${maxAttempts}). Backing off ${backoff}ms`, String(err));
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }

  throw new Error('OpenAI failed after retries');
}

/**
 * Extract transactions directly from PDF using OpenAI Files API + Responses API (fetch-based)
 */
async function extractTransactionsFromPdfWithOpenAI(pdfBytes: Uint8Array, fileName: string): Promise<any[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  let fileId: string | null = null;

  try {
    // 1) Upload PDF to OpenAI Files
    console.log('📤 Uploading PDF to OpenAI Files...');
    fileId = await uploadFileToOpenAI(pdfBytes, fileName || 'statement.pdf');
    console.log(`✅ Uploaded to OpenAI Files: ${fileId}`);

    // 2) Ask OpenAI to extract transactions from the PDF file_id with structured output
    console.log('📄 Extracting transactions from PDF using Responses API with structured output...');
    const resp = await callOpenAIResponses({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_file', file_id: fileId },
            {
              type: 'input_text',
              text: `Extract all bank transactions from this statement.

Rules:
- Debits must be negative numbers, credits positive
- Date format: YYYY-MM-DD
- Currency: "SGD" if not specified
- Balance: include if available on the row, else null
- Ignore: balance rows, totals, summary sections, headers, footers
- Extract ALL transaction rows you can identify`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "transactions_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
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
                    balance: { type: ["number", "null"] }
                  },
                  required: ["date", "description", "amount", "currency", "balance"]
                }
              }
            },
            required: ["transactions"]
          }
        }
      }
    });

    const outputText = readResponsesText(resp);
    
    // Log raw model output for debugging
    console.log("🧠 raw model output prefix:", outputText.slice(0, 200));
    
    // Hard fail if OpenAI refuses
    if (typeof outputText === 'string' && /can't assist/i.test(outputText)) {
      throw new Error('OpenAI refused the request. Ensure prompts do NOT ask for full transcription.');
    }

    // Parse JSON response with robust extractor
    let transactions: any[] = [];
    try {
      const parsed = extractJson(outputText);
      console.log("✅ parsed keys:", Object.keys(parsed ?? {}));
      
      // Handle both array and { transactions: [...] } formats
      if (Array.isArray(parsed)) {
        transactions = parsed;
      } else if (parsed && Array.isArray(parsed.transactions)) {
        transactions = parsed.transactions;
      } else {
        throw new Error(`Expected array or { transactions: [...] }, got: ${JSON.stringify(parsed).slice(0, 200)}`);
      }
      
      console.log("✅ OpenAI parsed transaction count:", transactions.length);

      // Validate transaction schema
      for (const t of transactions.slice(0, 50)) {
        if (!t.date || !t.description || typeof t.amount !== "number") {
          throw new Error(`Schema violation in OpenAI output: ${JSON.stringify(t).slice(0, 200)}`);
        }
      }

      if (transactions.length > 0) {
        console.log("✅ OpenAI first txn:", JSON.stringify(transactions[0]));
      }
    } catch (e) {
      console.error('❌ JSON extraction failed. Raw output (first 1000 chars):', outputText.slice(0, 1000));
      throw new Error(`Model did not return valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }

    return transactions;
  } catch (error) {
    console.error('❌ Error in extractTransactionsFromPdfWithOpenAI:', error);
    throw error;
  } finally {
    // Clean up: delete the file from OpenAI
    if (fileId) {
      await deleteFileFromOpenAI(fileId);
      console.log(`🗑️ Cleaned up OpenAI file: ${fileId}`);
    }
  }
}

interface RequestBody {
  upload_id: string;
  guest_token: string;
  debug?: boolean;
}

// @ts-ignore - Deno.serve is available at runtime
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('parse-statement invoked');
    
    const body: RequestBody = await req.json();
    const { upload_id, guest_token, debug } = body;
    
    // Log request details
    console.log('Request body:', {
      upload_id,
      guest_token,
      file_path: 'will be fetched from database',
    });
    
    // Log OpenAI API key presence (true/false only)
    console.log('OPENAI_API_KEY present:', !!OPENAI_API_KEY);

    if (!upload_id || !guest_token) {
      return new Response(
        JSON.stringify({ error: 'Missing upload_id or guest_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get upload record
    const upload = await supabaseSelect('upload', { id: upload_id, guest_token }, { single: true });

    if (!upload) {
      console.error('Upload not found');
      return new Response(
        JSON.stringify({ error: 'Upload not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency guard: if already done and has extract id, return success immediately
    if (upload.status === 'done' && (upload as any).statement_extract_id) {
      console.log('✅ Upload already processed, returning cached result');
      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          upload_id,
          statement_extract_id: (upload as any).statement_extract_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log upload details from DB
    console.log("🧾 DB upload.file_path:", upload.file_path);
    console.log("🧾 DB upload.file_name:", upload.file_name);
    console.log("🧾 DB upload.mime_type:", upload.mime_type);

    // 🧾 Debug: Log upload details
    console.log('🧾 Upload MIME / file_path:', {
      mime_type: upload.mime_type,
      file_path: upload.file_path,
      file_name: upload.file_name,
    });

    // Log file path after fetching
    console.log('Upload record found:', {
      upload_id: upload.id,
      file_path: upload.file_path,
      file_name: upload.file_name,
      mime_type: upload.mime_type,
    });

    // ASYNC JOB ARCHITECTURE: Enqueue job and return immediately
    // This prevents timeouts and makes processing feel instant
    await updateUpload(upload_id, {
      status: 'processing',
      processing_stage: 'queued',
      progress: 1,
    });

    // Create job record
    const { data: job, error: jobErr } = await supabaseInsert('jobs', {
      upload_id,
      status: 'queued',
      attempts: 0,
    }, { single: true });

    if (jobErr || !job) {
      console.error('Failed to create job:', jobErr);
      await updateUpload(upload_id, {
        status: 'error',
        processing_stage: 'error',
        error_message: 'Failed to enqueue processing job',
      });
      return new Response(
        JSON.stringify({ error: 'Failed to enqueue job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Job enqueued: ${job.id} for upload ${upload_id}`);

    // Return immediately - worker will process
    return new Response(
      JSON.stringify({ ok: true, job_id: job.id, queued: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // OLD SYNCHRONOUS CODE BELOW - KEPT FOR REFERENCE BUT NOT EXECUTED
    // The actual processing now happens in process-job worker function
    /*
    // Update status to processing and set initial progress
    await setStage(upload_id, 'starting', 3);

    // Heartbeat: update status every 10s so client never thinks it's dead
    let hbStopped = false;
    let hb: ReturnType<typeof setInterval> | null = null;
    
    try {
      hb = setInterval(() => {
        if (hbStopped) return;
        updateUpload(upload_id, { status: 'processing' }).catch(() => {});
      }, 10000);
      // 1) Fetch all page files for this upload_id
      // Try upload_files table first, fallback to parsing JSON from file_path
      let files: Array<{ file_path: string; mime_type: string; page_index?: number }> = [];
      
      const uploadFiles = await supabaseSelect('upload_files', { upload_id, guest_token }, { orderBy: 'page_index', ascending: true });

      if (uploadFiles && uploadFiles.length > 0) {
        // Use upload_files table if it exists
        files = uploadFiles.map((f: any) => ({
          file_path: f.file_path,
          mime_type: f.mime_type || upload.mime_type || 'image/jpeg',
          page_index: f.page_index || 0,
        }));
        console.log(`Found ${files.length} page files in upload_files table`);
      } else {
        // Fallback: Parse JSON from file_path (for batch uploads stored as JSON)
        try {
          const filePaths = JSON.parse(upload.file_path);
          if (Array.isArray(filePaths)) {
            files = filePaths.map((path: string, index: number) => ({
              file_path: path,
              mime_type: upload.mime_type || 'image/jpeg',
              page_index: index,
            }));
            console.log(`Found ${files.length} page files from JSON in file_path`);
          } else {
            // Single file (legacy format)
            files = [{
              file_path: upload.file_path,
              mime_type: upload.mime_type || 'image/jpeg',
              page_index: 0,
            }];
            console.log('Using single file_path (legacy format)');
          }
        } catch (parseError) {
          // Not JSON, treat as single file path
          files = [{
            file_path: upload.file_path,
            mime_type: upload.mime_type || 'image/jpeg',
            page_index: 0,
          }];
          console.log('Using single file_path (not JSON)');
        }
      }

      if (files.length === 0) {
        throw new Error(`No uploaded pages found for upload_id: ${upload_id}`);
      }

      console.log(`Processing ${files.length} page files for upload_id: ${upload_id}`);
      console.log('🧾 Upload MIME / file_path:', {
        mime_type: upload.mime_type,
        file_path: upload.file_path,
        file_name: upload.file_name,
        files_len: files?.length,
      });

      const mime = String(upload.mime_type || '').toLowerCase();
      const filePath0 = files?.[0]?.file_path || String(upload.file_path || '');
      const looksLikePdf = upload.mime_type === 'application/pdf' || filePath0.toLowerCase().endsWith('.pdf');

      console.log('📄 PDF DETECT:', { mime, filePath0, looksLikePdf, filesCount: files.length });

      let transactions: any[] = [];
      let allText = '';
      let normalized: any[] = [];
      let freeSummary: any;

      // --- ROUTE 1: PDF-FIRST (direct transaction extraction, no transcription) ---
      if (looksLikePdf && files.length === 1) {
        console.log('📄 Using OpenAI PDF path (Files API + Responses API)');

        // Create signed URL for downloading
        // Validate file path before signing
        if (!files[0].file_path || files[0].file_path.includes('undefined')) {
          throw new Error(`Invalid file_path: ${files[0].file_path}`);
        }
        
        // Validate file path before downloading
        if (!files[0].file_path || files[0].file_path.includes('undefined')) {
          throw new Error(`Invalid file_path: ${files[0].file_path}`);
        }

        // Download PDF using Supabase client's createSignedUrl (reliable)
        await setStage(upload_id, 'downloading', 15);
        console.log('📥 Downloading PDF from Supabase Storage...');
        const pdfBytes = await downloadPdfFromStorage('uploads', files[0].file_path);

        await setStage(upload_id, 'extracting_transactions', 35);

        // 2) Extract transactions using OpenAI Files API
        transactions = await extractTransactionsFromPdfWithOpenAI(pdfBytes, upload.file_name || 'statement.pdf');
        console.log(`✅ Extracted ${transactions.length} transactions from PDF`);
        console.log('🧾 Extracted transactions sample:', transactions.slice(0, 5));

        normalized = normalizeTransactions(transactions);
        console.log(`✅ Normalized ${normalized.length} transactions`);

        await setStage(upload_id, 'categorizing', 75);

        // Use transaction-based reconciliation for PDFs
        const recon = reconcileFromTransactions(normalized);
        freeSummary = computeFreeSummary(normalized, upload.file_name);
        freeSummary.reconciliation = recon;
        if (recon.ok === false) {
          freeSummary.confidence_note = `⚠️ Reconciliation mismatch (${recon.delta}). Some rows may be missing.`;
        }
        freeSummary.confidence = freeSummary.confidence || {};
        freeSummary.confidence.signals = { ...(freeSummary.confidence.signals || {}), reconciliation_ok: recon.ok };
        if (recon.ok === true) {
          // small confidence boost
          freeSummary.confidence.score = Math.min(0.95, Number((freeSummary.confidence.score + 0.08).toFixed(2)));
        }

        await setStage(upload_id, 'saving_results', 90);
      }

      // --- ROUTE 2: IMAGE / SCANNED fallback ---
      if (!looksLikePdf || files.length !== 1) {
        console.log('🖼️ Using image/vision OCR path...');

        const imageBase64s: string[] = [];
        let finalMimeType = upload.mime_type || 'image/jpeg';

        for (const f of files) {
          finalMimeType = f.mime_type || finalMimeType;

          // Validate file path before downloading
          if (!f.file_path || f.file_path.includes('undefined')) {
            throw new Error(`Invalid file_path: ${f.file_path}`);
          }
          
          console.log('🔎 Storage fetch path:', f.file_path);
          console.log('storage path raw:', f.file_path);
          console.log('storage path encoded:', encodeStoragePath(f.file_path));
          const fileBlob = await supabaseStorageDownload('uploads', f.file_path);
          const arrayBuffer = await fileBlob.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          imageBase64s.push(base64);
          console.log(`✅ Downloaded and converted page ${f.page_index ?? 'unknown'}`);
        }

        console.log(`Starting transcription of ${imageBase64s.length} pages...`);
        const pageTexts: string[] = [];
        for (let i = 0; i < imageBase64s.length; i++) {
          console.log(`Transcribing page ${i + 1}/${imageBase64s.length}...`);
          const t = await transcribePageWithOpenAI(imageBase64s[i], finalMimeType);
          pageTexts.push(`--- PAGE ${i + 1} ---\n${t}`);
          console.log(`✅ Page ${i + 1} transcribed (${t.length} chars)`);
        }

        allText = pageTexts.join('\n\n');
        
        // 🔍 DEBUG: Prove whether allText contains digits
        console.log('📄 allText length:', allText?.length ?? 0);
        const digitCount = (allText?.match(/\d/g) ?? []).length;
        console.log('🔢 digitCount:', digitCount);
        console.log('📄 allText sample (first 800):', allText?.slice(0, 800));
        console.log('📄 allText sample (last 800):', allText?.slice(-800));

        // 🔍 DEBUG: look for transaction-like lines
        const txnHints = allText.match(/\b\d{1,2}\s[A-Za-z]{3}\s\d{4}\b.*\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g)?.slice(0, 10) ?? [];
        console.log('🔎 TXN HINTS (up to 10):', txnHints);
        console.log("🔎 Contains 'Balance B/F'?", allText.includes('Balance B/F'));
        console.log("🔎 Contains 'Transaction Details'?", /Transaction\s+Details/i.test(allText));

        await setStage(upload_id, 'extracting_transactions', 35);

        transactions = await extractTransactionsWithTwoPass(pageTexts, allText);
        console.log(`✅ Extracted ${transactions.length} transactions`);
        console.log('🧾 Extracted transactions sample:', transactions.slice(0, 5));

        await setStage(upload_id, 'extracting_transactions', 60);

        await setStage(upload_id, 'categorizing', 75);

        normalized = normalizeTransactions(transactions);
        console.log(`✅ Normalized ${normalized.length} transactions`);

        // ✅ Reconciliation (text-based for images)
        const recon = reconcileFromStatementText(allText, normalized);
        freeSummary = computeFreeSummary(normalized, upload.file_name);
        freeSummary.reconciliation = recon;
        if (recon.ok === false) {
          freeSummary.confidence_note = `⚠️ Reconciliation mismatch: ${recon.delta}. Some transactions may be missing.`;
        }
        freeSummary.confidence = freeSummary.confidence || {};
        freeSummary.confidence.signals = { ...(freeSummary.confidence.signals || {}), reconciliation_ok: recon.ok };
        if (recon.ok === true) {
          freeSummary.confidence.score = Math.min(0.95, Number((freeSummary.confidence.score + 0.08).toFixed(2)));
        }
        if (recon.ok === false) {
          freeSummary.confidence.score = Math.max(0.05, Number((freeSummary.confidence.score - 0.12).toFixed(2)));
        }

        await setStage(upload_id, 'saving_results', 90);
      }

      // Save to database
      const statementExtract = await supabaseInsert('statement_extract', {
        upload_id: upload_id,
        guest_token: guest_token,
        period: freeSummary.period,
        free_summary: freeSummary,
        confidence: freeSummary.confidence ?? null,
        confidence_note: freeSummary.confidence_note || (mime.includes('pdf') 
          ? 'Extracted from PDF text. Please verify amounts and dates.' 
          : 'Extracted using AI vision. Please verify amounts and dates.'),
      }, { single: true });

      if (!statementExtract) {
        throw new Error('Failed to save extract');
      }

      // Update upload with statement_extract_id and mark as done (consolidated)
      hbStopped = true;
      if (hb) clearInterval(hb);
      
      await updateUpload(upload_id, {
        status: 'done',
        processing_stage: 'done',
        progress: 100,
        statement_extract_id: statementExtract.id,
        last_error: null,
        next_retry_at: null,
      });

      // Save transactions
      if (normalized.length > 0) {
        const transactionRecords = normalized.map(tx => ({
          upload_id: upload_id,
          statement_extract_id: statementExtract.id,
          guest_token: guest_token,
          date: tx.date,
          merchant: tx.merchant,
          category: tx.category,
          amount: tx.amount,
          description: tx.description,
        }));

        await supabaseInsert('transaction_extract', transactionRecords);
      }

      // Upload status already set to done above

      // TEMPORARILY DISABLED FOR TESTING - Allow unlimited uploads
      // Mark guest as used
      // await supabase.rpc('mark_guest_used', { p_guest_token: guest_token });

      console.log('Processing completed successfully:', {
        upload_id,
        statement_extract_id: statementExtract.id,
      });

      return Response.json({
        ok: true,
        success: true,
        upload_id,
        statement_extract_id: statementExtract.id,
        ...(debug ? { debug_sample_text: allText.slice(0, 2000) } : {}),
      }, {
        headers: { ...corsHeaders },
      });

    } catch (error) {
      console.error('Processing error:', error);
      
      // Stop heartbeat on error
      hbStopped = true;
      if (hb) clearInterval(hb);
      
      const message = error instanceof Error ? error.message : String(error);

      // Soft fail: if retryable OpenAI error, schedule retry instead of hard error
      if (isRetryableOpenAIError(message)) {
        try {
          const { data: row } = await supabaseSelect('upload', { id: upload_id }, { single: true });
          const attemptCount = ((row as any)?.attempt_count ?? 0) + 1;
          const maxQueueAttempts = 8;

          if (attemptCount <= maxQueueAttempts) {
            const delaySec = Math.min(120, 5 * Math.pow(2, attemptCount)); // 10s, 20s, 40s... capped at 120s
            const next = new Date(Date.now() + delaySec * 1000).toISOString();

            await updateUpload(upload_id, {
              status: 'processing',
              processing_stage: 'retrying_openai',
              progress: 60,
              attempt_count: attemptCount,
              next_retry_at: next,
              last_error: message.slice(0, 900),
            });

            console.log(`✅ Queued retry attempt ${attemptCount}/${maxQueueAttempts} in ${delaySec}s`);
            return Response.json(
              { ok: true, queued: true, retry_in_sec: delaySec },
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (retryError) {
          console.error('Failed to queue retry:', retryError);
          // Fall through to hard error
        }
      }

      // Hard error: update upload status to error (guaranteed)
      await updateUpload(upload_id, {
        status: 'error',
        processing_stage: 'error',
        progress: 100,
        error_message: message.slice(0, 900),
        last_error: message.slice(0, 900),
      });

      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    */
  } catch (err) {
    console.error('❌ parse-statement fatal:', err);
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, {
      status: 500,
      headers: { ...corsHeaders },
    });
  }
});

/**
 * Step 1: Transcribe a single page image to text using OpenAI Vision
 */
async function transcribePageWithOpenAI(imageBase64: string, mimeType: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // cheaper + good enough for transcription
      messages: [
        {
          role: 'system',
          content:
            'You are an OCR engine. Transcribe EXACTLY. Preserve spacing, columns, and line breaks. ' +
            'DO NOT reflow tables into paragraphs. Keep each row on its own line. ' +
            'Preserve numbers, dates, currency symbols exactly as shown. ' +
            'Do NOT summarize. Do NOT infer. Output plain text only.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this bank statement page verbatim.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      max_tokens: 2500,
      temperature: 0,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Extract transactions from PDF statement text (structured JSON response)
 */
async function extractTransactionsFromStatementText(statementText: string): Promise<any[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o', // strong for parsing statement text
      temperature: 0,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Extract bank transactions from the provided text.\n' +
            'Return STRICT JSON: { "transactions": [ ... ] }\n' +
            'Each item MUST have:\n' +
            '{ "date": "YYYY-MM-DD", "description": string, "amount": number, "currency": string, "balance": number|null }\n' +
            'Rules:\n' +
            '- Debits negative, credits positive.\n' +
            '- If date format is like "17 Mar" infer year from statement context if present; otherwise use current year.\n' +
            '- Amounts may contain commas or parentheses; normalize into number.\n' +
            '- If you cannot confidently parse a row, skip it.\n' +
            '- DO NOT invent transactions.',
        },
        { role: 'user', content: statementText.slice(0, 120000) }, // prevent huge payloads
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);
  return Array.isArray(parsed.transactions) ? parsed.transactions : [];
}

/**
 * Step 2: Two-pass extraction - first identify transaction pages, then extract from those only
 */
async function extractTransactionsWithTwoPass(pageTexts: string[], allText: string): Promise<any[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  // Pass A: Identify which pages contain transaction tables
  console.log('🔍 Pass A: Identifying pages with transaction tables...');
  const transactionPageIndices = await identifyTransactionPages(pageTexts);
  console.log(`✅ Found transaction tables on pages: ${transactionPageIndices.join(', ')}`);

  if (transactionPageIndices.length === 0) {
    console.log('⚠️ No transaction pages identified, trying extraction on all pages');
    // Fallback: try extraction on all pages
    return await extractTransactionsFromPages(pageTexts);
  }

  // Pass B: Extract transactions only from identified pages
  console.log('🔍 Pass B: Extracting transactions from identified pages...');
  const transactionPages = transactionPageIndices.map(i => pageTexts[i]);
  return await extractTransactionsFromPages(transactionPages);
}

/**
 * Pass A: Identify which pages contain transaction tables
 */
async function identifyTransactionPages(pageTexts: string[]): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  // Create a summary of each page for the model to analyze (include start and end)
  const pageSummaries = pageTexts.map((text, index) => 
    `PAGE ${index + 1} (${text.length} chars): ${text.slice(0, 600)} ... ${text.slice(-600)}`
  ).join('\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // cheaper for classification
      messages: [
        {
          role: 'system',
          content:
            'You analyze bank statement pages to identify which pages contain transaction tables.\n' +
            'Transaction tables have: date columns, amount columns, merchant/description columns, multiple rows.\n' +
            'Return ONLY a JSON array of page numbers (1-indexed) that contain transaction tables.\n' +
            'Example: [2, 3, 4] means pages 2, 3, and 4 have transaction tables.\n' +
            'Ignore pages with only summaries, balances, or overview sections.',
        },
        {
          role: 'user',
          content: `Which pages contain transaction tables?\n\n${pageSummaries}`,
        },
      ],
      max_tokens: 500,
      temperature: 0,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '[]';

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      // Convert 1-indexed to 0-indexed
      return parsed.map((n: number) => n - 1).filter((n: number) => n >= 0 && n < pageTexts.length);
    }
  } catch {
    // Try to extract array from text
    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed.map((n: number) => n - 1).filter((n: number) => n >= 0 && n < pageTexts.length);
        }
      } catch {}
    }
  }
  
  return [];
}

/**
 * Pass B: Extract transactions from specific pages
 */
async function extractTransactionsFromPages(pages: string[]): Promise<any[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const combinedText = pages.join('\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o', // stronger reasoning for structured extraction
      messages: [
        {
          role: 'system',
          content:
            'You extract transactions from bank statement text.\n' +
            'Return ONLY valid JSON array. Each item MUST include:\n' +
            '{ "date": "YYYY-MM-DD", "merchant": string, "amount": number, "currency": string, "description": string }\n' +
            'Debits should be negative. Credits positive.\n' +
            'If currency not shown, guess from symbols (S$ SGD, $ could be USD, RM MYR, etc) else "UNKNOWN".\n' +
            'Transaction rows typically have: date, description/merchant, amount.\n' +
            'Amounts may have commas (e.g., 1,234.56).\n' +
            'Debits may be marked as "DR" or shown in a debit column. Credits may be "CR" or in a credit column.\n' +
            'If debit/credit is unclear, use context: withdrawals/payments are negative, deposits/credits are positive.\n' +
            'Ignore: balance rows, totals, summary sections, headers, footers.\n' +
            'Extract ALL transaction rows you can identify.',
        },
        { role: 'user', content: combinedText },
      ],
      max_tokens: 4000, // Increased for multiple pages
      temperature: 0,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '[]';

  // parse JSON safely
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  }
}

/**
 * Money helpers (use cents internally for precision)
 */
function toCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(c: number): number {
  return Math.round(c) / 100;
}

/**
 * Normalize amount robustly (handles parentheses, commas, strings)
 */
function toNumberAmount(a: any): number {
  if (typeof a === 'number') return a;
  if (typeof a !== 'string') return Number(a || 0);

  const s = a.trim();
  // handle parentheses as negative
  const neg = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[(),]/g, '').replace(/\s/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

/**
 * Cash movement detection (critical for category filtering)
 */
function isCashMovementCategory(category: string) {
  const c = (category || '').toLowerCase();
  return (
    c.includes('transfers') ||
    c.includes('transfer') ||
    c.includes('credit card payment') ||
    c.includes('cash movement')
  );
}

function normalizeTransactions(transactions: any[]): any[] {
  return transactions.map((tx) => {
    const desc = String(tx.description || tx.merchant || '').trim();
    const key = desc.toUpperCase();

    // --- BANK PRIMITIVES (high signal) ---
    let category = 'Other';

    if (/PAYNOW/.test(key)) category = 'Transfers (PayNow)';
    else if (/FAST/.test(key)) category = 'Transfers (FAST)';
    else if (/GIRO/.test(key)) category = 'GIRO / Bills';
    else if (/ATM|CASH WITHDRAW/.test(key)) category = 'Cash Withdrawal';
    else if (/INTEREST/.test(key)) category = 'Interest';
    else if (/FEE|CHARGE|COMMISSION/.test(key)) category = 'Bank Fees';
    else if (/GRAB|GOJEK|TADA|RYDE/.test(key)) category = 'Transport';
    else if (/FAIRPRICE|NTUC|COLD STORAGE|SHENG SIONG|GIANT|DON DON DONKI/.test(key)) category = 'Groceries';
    else if (/AGODA|BOOKING\.COM|TRIP\.COM|EXPEDIA|AIRBNB/.test(key)) category = 'Travel';
    else if (/STARBUCKS|MCDONALD|KFC|SUBWAY|PIZZA|CAFE|COFFEE|RESTAURANT/.test(key)) category = 'Dining';
    else if (/NETFLIX|SPOTIFY|APPLE\.COM|GOOGLE|YOUTUBE|DISNEY/.test(key)) category = 'Subscriptions';
    else if (/UOB CARDS|CARD PAYMENT|CREDIT CARD/.test(key)) category = 'Credit Card Payment';
    else if (/SALARY|PAYROLL/.test(key)) category = 'Salary';

    // Amount normalization (robust)
    const amt = toNumberAmount(tx.amount);

    // Keep "Cash Movement" separate (exclude from top spending categories)
    const cashMovement = isCashMovementCategory(category);
    if (cashMovement) category = 'Cash Movement';

    return {
      date: tx.date || new Date().toISOString().split('T')[0],
      merchant: tx.merchant || desc || 'Unknown',
      category,
      amount: Number.isFinite(amt) ? amt : 0,
      description: desc,
      balance: tx.balance != null ? Number(tx.balance) : null,
      currency: tx.currency || 'SGD',
    };
  });
}

/**
 * Parse money amount from string (handles commas and spaces)
 */
function parseMoney(s: string): number | null {
  const m = s.replace(/[, ]/g, '').match(/-?\d+(\.\d{2})?/);
  return m ? Number(m[0]) : null;
}

/**
 * Reconcile extracted transactions against statement balances (text-based)
 */
function reconcileFromStatementText(statementText: string, txs: any[]) {
  // very light heuristics – good enough to detect missing rows
  const openingMatch = statementText.match(/Balance\s+B\/F.*?(\d{1,3}(?:,\d{3})*\.\d{2})/i);
  const closingMatch = statementText.match(/Balance\s+C\/F.*?(\d{1,3}(?:,\d{3})*\.\d{2})/i);

  const opening = openingMatch ? parseMoney(openingMatch[1]) : null;
  const closing = closingMatch ? parseMoney(closingMatch[1]) : null;

  const sum = txs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const expectedClosing = opening != null ? opening + sum : null;
  const delta = expectedClosing != null && closing != null ? Number((closing - expectedClosing).toFixed(2)) : null;

  return {
    opening,
    closing,
    tx_count: txs.length,
    sum: Number(sum.toFixed(2)),
    expectedClosing,
    delta,
    ok: delta != null ? Math.abs(delta) <= 0.05 : null,
    method: 'text_parsing',
  };
}

/**
 * Reconcile using running balances from transactions (more reliable for PDFs)
 */
function reconcileFromBalances(txs: any[]) {
  // Use first/last non-null running balances to infer opening/closing.
  const withBal = txs.filter(t => t.balance != null && Number.isFinite(Number(t.balance)));
  if (withBal.length < 2) {
    return { ok: null, delta: null, method: 'insufficient_balances' };
  }

  const first = withBal[0];
  const last = withBal[withBal.length - 1];

  const firstBal = Number(first.balance);
  const firstAmt = Number(first.amount || 0);
  const opening = Number.isFinite(firstBal - firstAmt) ? (firstBal - firstAmt) : null;

  const closing = Number(last.balance);
  const sum = txs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const expectedClosing = opening != null ? opening + sum : null;
  const delta = (expectedClosing != null && closing != null) ? Number((closing - expectedClosing).toFixed(2)) : null;

  const ok = delta != null ? Math.abs(delta) <= 0.05 : null;
  return {
    opening,
    closing,
    expectedClosing,
    sum: Number(sum.toFixed(2)),
    delta,
    ok,
    method: 'running_balance',
    tx_count: txs.length,
  };
}

/**
 * Reconcile from transactions (uses running balances if present)
 */
function reconcileFromTransactions(txs: any[]) {
  // Uses running balances if present (best effort)
  const withBal = txs.filter(t => t.balance != null && Number.isFinite(Number(t.balance)));
  if (withBal.length < 2) {
    return { ok: null, method: 'tx_balance_unavailable', opening: null, closing: null, delta: null };
  }

  // assume first balance is balance AFTER first txn
  const first = withBal[0];
  const last = withBal[withBal.length - 1];

  const firstBal = Number(first.balance);
  const firstAmt = Number(first.amount || 0);
  const opening = fromCents(toCents(firstBal) - toCents(firstAmt)); // opening ≈ firstBal - firstAmt

  const closing = Number(last.balance);

  const sum = txs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const expectedClosing = fromCents(toCents(opening) + toCents(sum));
  const delta = fromCents(toCents(closing) - toCents(expectedClosing));

  return {
    method: 'tx_running_balance',
    opening,
    closing,
    sum: fromCents(toCents(sum)),
    expectedClosing,
    delta,
    ok: Math.abs(delta) <= 0.05,
    tx_count: txs.length,
  };
}

/**
 * Compute confidence score (0..1) based on transaction quality and reconciliation
 */
function computeConfidenceScore({ txs, recon }: { txs: any[]; recon: any }) {
  // Start from 1.0 and subtract penalties
  let score = 1.0;

  // Penalty: no transactions
  if (!txs || txs.length === 0) score -= 0.7;

  // Penalty: missing many dates/amounts
  const missingDate = txs.filter(t => !t.date).length;
  const badAmount = txs.filter(t => !Number.isFinite(Number(t.amount))).length;
  const missingMerchant = txs.filter(t => !t.merchant && !t.description).length;

  const n = Math.max(1, txs.length);
  score -= (missingDate / n) * 0.25;
  score -= (badAmount / n) * 0.35;
  score -= (missingMerchant / n) * 0.15;

  // Reconciliation penalty/bonus
  if (recon?.ok === true) score += 0.08;
  if (recon?.ok === false) score -= 0.25;
  if (recon?.ok == null) score -= 0.12;

  // Clamp
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function computeFreeSummary(transactions: any[], fileName: string): any {
  // cents precision
  const inflows = transactions.filter(t => Number(t.amount) > 0);
  const outflows = transactions.filter(t => Number(t.amount) < 0);

  const inflowC = inflows.reduce((sum, t) => sum + toCents(Number(t.amount) || 0), 0);
  const outflowC = outflows.reduce((sum, t) => sum + Math.abs(toCents(Number(t.amount) || 0)), 0);
  const netC = inflowC - outflowC;

  const inflow = fromCents(inflowC);
  const outflow = fromCents(outflowC);
  const netCashflow = fromCents(netC);

  // Spending categories exclude Cash Movement
  const spendingOutflows = outflows.filter(t => !isCashMovementCategory(t.category));
  const categoryTotalsC: Record<string, number> = {};
  for (const t of spendingOutflows) {
    const cat = t.category || 'Other';
    categoryTotalsC[cat] = (categoryTotalsC[cat] || 0) + Math.abs(toCents(Number(t.amount) || 0));
  }

  const topCategories = Object.entries(categoryTotalsC)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, cents]) => ({ name, amount: Math.round(fromCents(cents)) })); // display rounded dollars

  // confidence signals
  const txCount = transactions.length;
  const otherC = categoryTotalsC['Other'] || 0;
  const spendC = Object.values(categoryTotalsC).reduce((a, b) => a + b, 0) || 1;
  const otherShare = otherC / spendC;

  const hasBalanceCount = transactions.filter(t => t.balance != null && Number.isFinite(Number(t.balance))).length;
  const balanceCoverage = txCount > 0 ? hasBalanceCount / txCount : 0;

  // Insights
  const insights: string[] = [];

  if (netCashflow >= 0) {
    insights.push(`Your net cashflow is positive this month ($${netCashflow.toLocaleString(undefined, { maximumFractionDigits: 2 })})`);
    const savingsRate = inflow > 0 ? (netCashflow / inflow) * 100 : 0;
    insights.push(`You saved ${Math.round(savingsRate)}% of your income this month`);
  } else {
    insights.push(`Your spending exceeded income by $${Math.abs(netCashflow).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
    const burnRate = inflow > 0 ? (Math.abs(netCashflow) / inflow) * 100 : 0;
    insights.push(`You spent ${Math.round(burnRate)}% more than you earned this month`);
  }

  if (topCategories.length > 0) {
    insights.push(`${topCategories[0].name} was your top spending category ($${topCategories[0].amount.toLocaleString()})`);
  }

  // Flag examples
  const subscriptionC = categoryTotalsC['Subscriptions'] || 0;
  const flag = fromCents(subscriptionC) > 200 ? '⚠️ High subscription spending detected' : null;

  // Period (keep your current logic for now)
  const now = new Date();
  const period = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  // confidence score (cheap + explainable)
  // - penalize high Other share
  // - reward balance coverage
  // - reward having non-trivial transaction count
  let score = 0.55;
  score += Math.min(0.20, balanceCoverage * 0.20);
  score += txCount >= 25 ? 0.10 : txCount >= 10 ? 0.05 : 0;
  score -= Math.min(0.25, otherShare * 0.35);

  score = Math.max(0.05, Math.min(0.95, score));

  const confidence = {
    score: Number(score.toFixed(2)),
    signals: {
      tx_count: txCount,
      other_share: Number(otherShare.toFixed(2)),
      balance_coverage: Number(balanceCoverage.toFixed(2)),
      cash_movement_excluded_from_top_categories: true,
    },
  };

  return {
    period,
    totals: {
      inflow: Math.round(inflow),
      outflow: Math.round(outflow),
      netCashflow: Math.round(netCashflow),
      inflow_exact: Number(inflow.toFixed(2)),
      outflow_exact: Number(outflow.toFixed(2)),
      netCashflow_exact: Number(netCashflow.toFixed(2)),
    },
    topCategories,
    insights: insights.slice(0, 3),
    flag,
  };
}

