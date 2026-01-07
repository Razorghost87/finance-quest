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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================================
// HELPER FUNCTIONS (copied from parse-statement)
// ============================================================================

function encodeStoragePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function normalizeSignedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.pathname.includes('/storage/v1/object/')) {
      u.pathname = `/storage/v1/object${u.pathname}`;
    }
    return u.toString();
  } catch {
    return url;
  }
}

function extractJson(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new Error('Input is not a valid string');
  }
  let cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to extraction
  }
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }
  if (start === -1) {
    throw new Error(`No JSON found in model output. First 200 chars: ${text.slice(0, 200)}`);
  }
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks to avoid call stack issues
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    const chunkArray = Array.from(chunk);
    binary += String.fromCharCode(...chunkArray);
  }
  return btoa(binary);
}

function readResponsesText(data: any): string {
  if (typeof data.output_text === 'string') return data.output_text;
  const chunks = data.output?.flatMap((o: any) => o.content ?? []) ?? [];
  const texts = chunks
    .map((c: any) => c.text ?? c?.content?.text ?? '')
    .filter(Boolean);
  return texts.join('');
}

async function supabaseFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${SUPABASE_PROJECT_URL}/rest/v1${endpoint}`;
  const headers = new Headers(options.headers);
  if (!headers.has('Prefer')) {
    headers.set('Prefer', 'return=representation');
  }
  headers.set('apikey', SUPABASE_SERVICE_KEY);
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
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
  return response.json();
}

async function supabaseSelect(table: string, filters: Record<string, any> = {}, options: { single?: boolean; orderBy?: string; ascending?: boolean } = {}): Promise<any> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    params.append(key, `eq.${value}`);
  }
  if (options.orderBy) {
    params.append('order', `${options.orderBy}.${options.ascending !== false ? 'asc' : 'desc'}`);
  }
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

async function updateUpload(upload_id: string, patch: Record<string, any>) {
  try {
    await supabaseUpdate('upload', patch, { id: upload_id });
  } catch (error) {
    console.error('Failed to update upload row:', error);
  }
}

async function setStage(upload_id: string, stage: string, progress: number) {
  await updateUpload(upload_id, {
    processing_stage: stage,
    progress: Math.max(0, Math.min(100, progress)),
    status: 'processing',
  });
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callOpenAIResponses(body: any): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const maxAttempts = 6;
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
        if (isRetryableStatus(res.status) && attempt < maxAttempts) {
          const backoff = Math.min(15000, 600 * Math.pow(2, attempt - 1));
          console.warn(`⚠️ OpenAI ${res.status} retrying attempt ${attempt}/${maxAttempts} in ${backoff}ms`);
          await sleep(backoff);
          continue;
        }
        throw new Error(`OpenAI Responses failed ${res.status}: ${text.slice(0, 600)}`);
      }
      return JSON.parse(text);
    } catch (err) {
      if (attempt < maxAttempts) {
        const backoff = Math.min(15000, 600 * Math.pow(2, attempt - 1));
        console.warn(`⚠️ OpenAI error retrying attempt ${attempt}/${maxAttempts} in ${backoff}ms:`, String(err));
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error('OpenAI failed after retries');
}

async function downloadPdfFromStorage(bucket: string, filePath: string): Promise<Uint8Array> {
  const storagePathRaw = filePath;
  if (!storagePathRaw || storagePathRaw.includes("undefined")) {
    throw new Error(`Invalid storage path: ${storagePathRaw}`);
  }
  const { data, error } = await supabaseStorage.storage
    .from(bucket)
    .createSignedUrl(storagePathRaw, 600);
  if (error) throw new Error(`createSignedUrl failed: ${error.message}`);
  if (!data?.signedUrl) throw new Error(`createSignedUrl returned no URL`);
  const urlToFetch = normalizeSignedUrl(data.signedUrl);
  const res = await fetch(urlToFetch);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes;
}

async function supabaseStorageDownload(bucket: string, path: string): Promise<Blob> {
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

async function uploadFileToOpenAI(pdfBytes: Uint8Array, fileName: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const form = new FormData();
  form.append('purpose', 'assistants');
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
  const data = JSON.parse(text);
  return data.id;
}

async function deleteFileFromOpenAI(fileId: string): Promise<void> {
  if (!OPENAI_API_KEY) return;
  try {
    const response = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    });
    if (!response.ok) {
      console.warn(`⚠️ Failed to delete OpenAI file ${fileId}: ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to cleanup OpenAI file:', error);
  }
}

async function extractTransactionsFromPdfWithOpenAI(pdfBytes: Uint8Array, fileName: string): Promise<any[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  let fileId: string | null = null;
  try {
    console.log('📤 Uploading PDF to OpenAI Files...');
    fileId = await uploadFileToOpenAI(pdfBytes, fileName || 'statement.pdf');
    console.log(`✅ Uploaded to OpenAI Files: ${fileId}`);
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
    console.log("🧠 raw model output prefix:", outputText.slice(0, 200));
    if (typeof outputText === 'string' && /can't assist/i.test(outputText)) {
      throw new Error('OpenAI refused the request. Ensure prompts do NOT ask for full transcription.');
    }
    let transactions: any[] = [];
    try {
      const parsed = extractJson(outputText);
      console.log("✅ parsed keys:", Object.keys(parsed ?? {}));
      if (Array.isArray(parsed)) {
        transactions = parsed;
      } else if (parsed && Array.isArray(parsed.transactions)) {
        transactions = parsed.transactions;
      } else {
        throw new Error(`Expected array or { transactions: [...] }, got: ${JSON.stringify(parsed).slice(0, 200)}`);
      }
      console.log("✅ OpenAI parsed transaction count:", transactions.length);
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
    if (fileId) {
      await deleteFileFromOpenAI(fileId);
      console.log(`🗑️ Cleaned up OpenAI file: ${fileId}`);
    }
  }
}

async function transcribePageWithOpenAI(imageBase64: string, mimeType: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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

async function identifyTransactionPages(pageTexts: string[]): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
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
      model: 'gpt-4o-mini',
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
      return parsed.map((n: number) => n - 1).filter((n: number) => n >= 0 && n < pageTexts.length);
    }
  } catch {
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
      model: 'gpt-4o',
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
      max_tokens: 4000,
      temperature: 0,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '[]';
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  }
}

async function extractTransactionsWithTwoPass(pageTexts: string[], allText: string): Promise<any[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  console.log('🔍 Pass A: Identifying pages with transaction tables...');
  const transactionPageIndices = await identifyTransactionPages(pageTexts);
  console.log(`✅ Found transaction tables on pages: ${transactionPageIndices.join(', ')}`);
  if (transactionPageIndices.length === 0) {
    console.log('⚠️ No transaction pages identified, trying extraction on all pages');
    return await extractTransactionsFromPages(pageTexts);
  }
  console.log('🔍 Pass B: Extracting transactions from identified pages...');
  const transactionPages = transactionPageIndices.map(i => pageTexts[i]);
  return await extractTransactionsFromPages(transactionPages);
}

function toCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(c: number): number {
  return Math.round(c) / 100;
}

function toNumberAmount(a: any): number {
  if (typeof a === 'number') return a;
  if (typeof a !== 'string') return Number(a || 0);
  const s = a.trim();
  const neg = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[(),]/g, '').replace(/\s/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

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
    const amt = toNumberAmount(tx.amount);
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

function parseMoney(s: string): number | null {
  const m = s.replace(/[, ]/g, '').match(/-?\d+(\.\d{2})?/);
  return m ? Number(m[0]) : null;
}

function reconcileFromStatementText(statementText: string, txs: any[]) {
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

function reconcileFromTransactions(txs: any[]) {
  const withBal = txs.filter(t => t.balance != null && Number.isFinite(Number(t.balance)));
  if (withBal.length < 2) {
    return { ok: null, method: 'tx_balance_unavailable', opening: null, closing: null, delta: null };
  }
  const first = withBal[0];
  const last = withBal[withBal.length - 1];
  const firstBal = Number(first.balance);
  const firstAmt = Number(first.amount || 0);
  const opening = fromCents(toCents(firstBal) - toCents(firstAmt));
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

function computeConfidenceScore({ txs, recon }: { txs: any[]; recon: any }) {
  let score = 1.0;
  if (!txs || txs.length === 0) score -= 0.7;
  const missingDate = txs.filter(t => !t.date).length;
  const badAmount = txs.filter(t => !Number.isFinite(Number(t.amount))).length;
  const missingMerchant = txs.filter(t => !t.merchant && !t.description).length;
  const n = Math.max(1, txs.length);
  score -= (missingDate / n) * 0.25;
  score -= (badAmount / n) * 0.35;
  score -= (missingMerchant / n) * 0.15;
  if (recon?.ok === true) score += 0.08;
  if (recon?.ok === false) score -= 0.25;
  if (recon?.ok == null) score -= 0.12;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

/**
 * Normalize merchant name for subscription detection
 */
function normalizeMerchant(merchant: string): string {
  return merchant
    .toUpperCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+REF\s+.*$/i, '') // Remove trailing refs
    .replace(/\s+\d{4,}.*$/, '') // Remove trailing numbers
    .trim();
}

/**
 * Known subscription merchants (allowlist for confidence boost)
 */
const KNOWN_SUBSCRIPTION_MERCHANTS = new Set([
  'NETFLIX', 'SPOTIFY', 'APPLE', 'GOOGLE', 'YOUTUBE', 'DISNEY',
  'AMAZON PRIME', 'PRIME VIDEO', 'HBO', 'HULU', 'DISNEY PLUS',
  'MICROSOFT', 'ADOBE', 'ADOBE CREATIVE', 'FIGMA', 'NOTION',
  'SLACK', 'ZOOM', 'DROPBOX', 'ICLOUD', 'ONEDRIVE',
]);

/**
 * Detect subscriptions from normalized transactions
 * Phase 1: Simple, strong, explainable algorithm
 */
function detectSubscriptions(transactions: any[]): any[] {
  // Filter out cash movements and positive amounts (inflows)
  const candidateTxs = transactions.filter(
    t => Number(t.amount) < 0 && !isCashMovementCategory(t.category)
  );

  // Group by normalized merchant
  const byMerchant: Record<string, any[]> = {};
  for (const tx of candidateTxs) {
    const normalized = normalizeMerchant(tx.merchant || tx.description || '');
    if (!normalized || normalized.length < 3) continue;
    if (!byMerchant[normalized]) byMerchant[normalized] = [];
    byMerchant[normalized].push({ ...tx, normalizedMerchant: normalized });
  }

  const subscriptions: any[] = [];

  for (const [normalizedMerchant, txs] of Object.entries(byMerchant)) {
    if (txs.length < 2) continue; // Need at least 2 occurrences

    // Sort by date
    txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate amount statistics
    const amounts = txs.map(t => Math.abs(Number(t.amount)));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountVariance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
    const amountStdDev = Math.sqrt(amountVariance);
    const amountTolerance = Math.max(avgAmount * 0.02, 1.50); // ±2% or ±$1.50

    // Check if amounts are consistent
    const amountsConsistent = amounts.every(amt => Math.abs(amt - avgAmount) <= amountTolerance);

    // Calculate interval statistics
    const intervals: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      const days = Math.round(
        (new Date(txs[i].date).getTime() - new Date(txs[i - 1].date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > 0 && days < 400) intervals.push(days);
    }

    if (intervals.length === 0) continue;

    const intervalAvg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, d) => sum + Math.pow(d - intervalAvg, 2), 0) / intervals.length;
    const intervalStdDev = Math.sqrt(intervalVariance);

    // Determine interval type
    let interval: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'unknown' = 'unknown';
    if (intervalAvg >= 6 && intervalAvg <= 8) interval = 'weekly';
    else if (intervalAvg >= 25 && intervalAvg <= 35) interval = 'monthly';
    else if (intervalAvg >= 85 && intervalAvg <= 95) interval = 'quarterly';
    else if (intervalAvg >= 350 && intervalAvg <= 380) interval = 'annual';

    // Calculate confidence
    let confidence = 0.35; // base
    if (txs.length >= 3) confidence += 0.25;
    if (interval !== 'unknown') confidence += 0.20;
    if (amountsConsistent) confidence += 0.15;
    if (KNOWN_SUBSCRIPTION_MERCHANTS.has(normalizedMerchant)) confidence += 0.05;
    confidence = Math.min(1.0, confidence);

    // Only include if confidence is reasonable
    if (confidence < 0.5 && txs.length < 3) continue;

    // Calculate next expected date
    const lastDate = new Date(txs[txs.length - 1].date);
    let nextExpectedDate: string | null = null;
    if (interval === 'weekly') {
      nextExpectedDate = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else if (interval === 'monthly') {
      const next = new Date(lastDate);
      next.setMonth(next.getMonth() + 1);
      nextExpectedDate = next.toISOString().split('T')[0];
    } else if (interval === 'quarterly') {
      const next = new Date(lastDate);
      next.setMonth(next.getMonth() + 3);
      nextExpectedDate = next.toISOString().split('T')[0];
    } else if (interval === 'annual') {
      const next = new Date(lastDate);
      next.setFullYear(next.getFullYear() + 1);
      nextExpectedDate = next.toISOString().split('T')[0];
    }

    subscriptions.push({
      merchant: txs[0].merchant || txs[0].description || 'Unknown',
      normalizedMerchant,
      amount: Number(avgAmount.toFixed(2)),
      currency: txs[0].currency || 'SGD',
      interval,
      occurrences: txs.length,
      lastSeenDate: txs[txs.length - 1].date,
      nextExpectedDate,
      confidence: Number(confidence.toFixed(2)),
      evidence: {
        amountVariance: Number(amountStdDev.toFixed(2)),
        intervalDaysAvg: Number(intervalAvg.toFixed(1)),
        intervalDaysStd: Number(intervalStdDev.toFixed(1)),
      },
      source: 'statement',
    });
  }

  // Sort by confidence descending
  subscriptions.sort((a, b) => b.confidence - a.confidence);

  return subscriptions;
}

function computeFreeSummary(transactions: any[], fileName: string, subscriptions: any[] = [], reconciliation: any = null): any {
  const inflows = transactions.filter(t => Number(t.amount) > 0);
  const outflows = transactions.filter(t => Number(t.amount) < 0);
  const inflowC = inflows.reduce((sum, t) => sum + toCents(Number(t.amount) || 0), 0);
  const outflowC = outflows.reduce((sum, t) => sum + Math.abs(toCents(Number(t.amount) || 0)), 0);
  const netC = inflowC - outflowC;
  const inflow = fromCents(inflowC);
  const outflow = fromCents(outflowC);
  const netCashflow = fromCents(netC);
  const spendingOutflows = outflows.filter(t => !isCashMovementCategory(t.category));
  const categoryTotalsC: Record<string, number> = {};
  for (const t of spendingOutflows) {
    const cat = t.category || 'Other';
    categoryTotalsC[cat] = (categoryTotalsC[cat] || 0) + Math.abs(toCents(Number(t.amount) || 0));
  }
  const topCategories = Object.entries(categoryTotalsC)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, cents]) => ({ name, amount: Math.round(fromCents(cents)) }));
  const txCount = transactions.length;
  const otherC = categoryTotalsC['Other'] || 0;
  const spendC = Object.values(categoryTotalsC).reduce((a, b) => a + b, 0) || 1;
  const otherShare = otherC / spendC;
  const hasBalanceCount = transactions.filter(t => t.balance != null && Number.isFinite(Number(t.balance))).length;
  const balanceCoverage = txCount > 0 ? hasBalanceCount / txCount : 0;
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
  
  // Subscription insights
  if (subscriptions.length > 0) {
    const totalMonthly = subscriptions
      .filter(s => s.interval === 'monthly')
      .reduce((sum, s) => sum + s.amount, 0);
    const totalAnnual = subscriptions
      .filter(s => s.interval === 'annual')
      .reduce((sum, s) => sum + (s.amount / 12), 0);
    const totalWeekly = subscriptions
      .filter(s => s.interval === 'weekly')
      .reduce((sum, s) => sum + (s.amount * 4.33), 0);
    const totalMonthlyCommitments = totalMonthly + totalAnnual + totalWeekly;
    if (totalMonthlyCommitments > 0) {
      insights.push(`You have $${Math.round(totalMonthlyCommitments)} in recurring monthly commitments`);
    }
  }
  
  const subscriptionC = categoryTotalsC['Subscriptions'] || 0;
  const flag = fromCents(subscriptionC) > 200 ? '⚠️ High subscription spending detected' : null;
  const now = new Date();
  const period = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
  
  // Enhanced confidence scoring (Phase 1)
  const expectedTxCount = 30; // Reasonable expectation
  const extractConf = Math.min(1.0, Math.max(0.3, txCount / expectedTxCount));
  const reconConf = reconciliation?.confidence ?? (reconciliation?.ok === true ? 0.95 : reconciliation?.ok === false ? 0.2 : 0.4);
  const subsConf = subscriptions.length > 0 
    ? subscriptions.reduce((sum, s) => sum + s.confidence, 0) / subscriptions.length 
    : 0.4;
  
  const score = 0.45 * reconConf + 0.35 * extractConf + 0.20 * subsConf;
  const grade = score >= 0.75 ? 'high' : score >= 0.55 ? 'medium' : 'low';
  
  const reasons: string[] = [];
  if (txCount > 0) reasons.push(`${txCount} transactions extracted`);
  if (reconciliation?.ok === true) {
    const delta = reconciliation.delta != null ? Math.abs(reconciliation.delta).toFixed(2) : '0';
    reasons.push(`Reconciled within $${delta}`);
  }
  if (subscriptions.length > 0) {
    reasons.push(`${subscriptions.length} recurring charge${subscriptions.length > 1 ? 's' : ''} detected`);
  }
  
  const confidence = {
    score: Number(score.toFixed(2)),
    grade,
    reasons,
    signals: {
      tx_count: txCount,
      other_share: Number(otherShare.toFixed(2)),
      balance_coverage: Number(balanceCoverage.toFixed(2)),
      cash_movement_excluded_from_top_categories: true,
      reconciliation_ok: reconciliation?.ok,
      subscription_count: subscriptions.length,
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
    confidence,
    subscriptions: subscriptions.map(s => ({
      merchant: s.merchant,
      amount: s.amount,
      interval: s.interval,
      confidence: s.confidence,
      nextExpectedDate: s.nextExpectedDate,
    })),
    reconciliation: reconciliation ? {
      opening: reconciliation.opening,
      closing: reconciliation.closing,
      sum: reconciliation.sum,
      expectedClosing: reconciliation.expectedClosing,
      delta: reconciliation.delta,
      ok: reconciliation.ok,
      tx_count: reconciliation.tx_count,
      confidence: reconConf,
    } : null,
  };
}

// ============================================================================
// MAIN WORKER FUNCTION
// ============================================================================

interface RequestBody {
  job_id?: string;
  upload_id?: string;
}

// @ts-ignore - Deno.serve is available at runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('process-job invoked');
    const body: RequestBody = await req.json();
    const { job_id, upload_id } = body;

    // Pick a queued job (or use provided job_id/upload_id)
    let job: any;
    if (job_id) {
      job = await supabaseSelect('jobs', { id: job_id }, { single: true });
    } else if (upload_id) {
      job = await supabaseSelect('jobs', { upload_id, status: 'queued' }, { single: true });
    } else {
      // Pick oldest queued job
      const jobs = await supabaseSelect('jobs', { status: 'queued' }, { orderBy: 'created_at', ascending: true });
      job = Array.isArray(jobs) && jobs.length > 0 ? jobs[0] : null;
    }

    if (!job) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No jobs to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upload_id_final = job.upload_id;

    // Claim job
    await supabaseUpdate('jobs', {
      status: 'processing',
      attempts: job.attempts + 1,
    }, { id: job.id });

    // Get upload record
    const upload = await supabaseSelect('upload', { id: upload_id_final }, { single: true });
    if (!upload) {
      await supabaseUpdate('jobs', {
        status: 'error',
        last_error: 'Upload not found',
      }, { id: job.id });
      throw new Error('Upload not found');
    }

    const guest_token = upload.guest_token;

    // Set initial progress
    await setStage(upload_id_final, 'starting', 3);

    // Heartbeat
    let hbStopped = false;
    let hb: ReturnType<typeof setInterval> | null = null;
    
    try {
      hb = setInterval(() => {
        if (hbStopped) return;
        updateUpload(upload_id_final, { status: 'processing' }).catch(() => {});
      }, 10000);

      // ========================================================================
      // FULL PROCESSING PIPELINE (copied from parse-statement)
      // ========================================================================

      // 1) Fetch all page files for this upload_id
      let files: Array<{ file_path: string; mime_type: string; page_index?: number }> = [];
      
      const uploadFiles = await supabaseSelect('upload_files', { upload_id: upload_id_final, guest_token }, { orderBy: 'page_index', ascending: true });

      if (uploadFiles && uploadFiles.length > 0) {
        files = uploadFiles.map((f: any) => ({
          file_path: f.file_path,
          mime_type: f.mime_type || upload.mime_type || 'image/jpeg',
          page_index: f.page_index || 0,
        }));
        console.log(`Found ${files.length} page files in upload_files table`);
      } else {
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
            files = [{
              file_path: upload.file_path,
              mime_type: upload.mime_type || 'image/jpeg',
              page_index: 0,
            }];
            console.log('Using single file_path (legacy format)');
          }
        } catch (parseError) {
          files = [{
            file_path: upload.file_path,
            mime_type: upload.mime_type || 'image/jpeg',
            page_index: 0,
          }];
          console.log('Using single file_path (not JSON)');
        }
      }

      if (files.length === 0) {
        throw new Error(`No uploaded pages found for upload_id: ${upload_id_final}`);
      }

      console.log(`Processing ${files.length} page files for upload_id: ${upload_id_final}`);
      const mime = String(upload.mime_type || '').toLowerCase();
      const filePath0 = files?.[0]?.file_path || String(upload.file_path || '');
      const looksLikePdf = upload.mime_type === 'application/pdf' || filePath0.toLowerCase().endsWith('.pdf');

      console.log('📄 PDF DETECT:', { mime, filePath0, looksLikePdf, filesCount: files.length });

      let transactions: any[] = [];
      let allText = '';
      let normalized: any[] = [];
      let freeSummary: any;

      // --- ROUTE 1: PDF-FIRST ---
      if (looksLikePdf && files.length === 1) {
        console.log('📄 Using OpenAI PDF path (Files API + Responses API)');
        if (!files[0].file_path || files[0].file_path.includes('undefined')) {
          throw new Error(`Invalid file_path: ${files[0].file_path}`);
        }
        await setStage(upload_id_final, 'downloading', 15);
        console.log('📥 Downloading PDF from Supabase Storage...');
        const pdfBytes = await downloadPdfFromStorage('uploads', files[0].file_path);
        await setStage(upload_id_final, 'extracting_transactions', 35);
        transactions = await extractTransactionsFromPdfWithOpenAI(pdfBytes, upload.file_name || 'statement.pdf');
        console.log(`✅ Extracted ${transactions.length} transactions from PDF`);
        normalized = normalizeTransactions(transactions);
        console.log(`✅ Normalized ${normalized.length} transactions`);
        await setStage(upload_id_final, 'categorizing', 55);
        
        // Detect subscriptions
        await setStage(upload_id_final, 'detecting_subscriptions', 70);
        const subscriptions = detectSubscriptions(normalized);
        console.log(`✅ Detected ${subscriptions.length} subscription candidates`);
        
        // Reconciliation
        await setStage(upload_id_final, 'reconciling', 80);
        const recon = reconcileFromTransactions(normalized);
        const reconConfidence = recon.ok === true 
          ? 0.95 
          : recon.ok === false 
            ? Math.max(0.2, 0.95 - Math.abs(recon.delta || 0) / 50)
            : 0.4;
        recon.confidence = reconConfidence;
        
        // Compute free summary with subscriptions and reconciliation
        freeSummary = computeFreeSummary(normalized, upload.file_name, subscriptions, recon);
        if (recon.ok === false) {
          freeSummary.confidence_note = `⚠️ Reconciliation mismatch (${recon.delta}). Some rows may be missing.`;
        }
        await setStage(upload_id_final, 'saving_results', 90);
      }

      // --- ROUTE 2: IMAGE / SCANNED fallback ---
      if (!looksLikePdf || files.length !== 1) {
        console.log('🖼️ Using image/vision OCR path...');
        const imageBase64s: string[] = [];
        let finalMimeType = upload.mime_type || 'image/jpeg';
        for (const f of files) {
          finalMimeType = f.mime_type || finalMimeType;
          if (!f.file_path || f.file_path.includes('undefined')) {
            throw new Error(`Invalid file_path: ${f.file_path}`);
          }
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
        await setStage(upload_id_final, 'extracting_transactions', 35);
        transactions = await extractTransactionsWithTwoPass(pageTexts, allText);
        console.log(`✅ Extracted ${transactions.length} transactions`);
        await setStage(upload_id_final, 'categorizing', 55);
        normalized = normalizeTransactions(transactions);
        console.log(`✅ Normalized ${normalized.length} transactions`);
        
        // Detect subscriptions
        await setStage(upload_id_final, 'detecting_subscriptions', 70);
        const subscriptions = detectSubscriptions(normalized);
        console.log(`✅ Detected ${subscriptions.length} subscription candidates`);
        
        // Reconciliation
        await setStage(upload_id_final, 'reconciling', 80);
        const recon = reconcileFromStatementText(allText, normalized);
        const reconConfidence = recon.ok === true 
          ? 0.95 
          : recon.ok === false 
            ? Math.max(0.2, 0.95 - Math.abs(recon.delta || 0) / 50)
            : 0.4;
        recon.confidence = reconConfidence;
        
        // Compute free summary with subscriptions and reconciliation
        freeSummary = computeFreeSummary(normalized, upload.file_name, subscriptions, recon);
        if (recon.ok === false) {
          freeSummary.confidence_note = `⚠️ Reconciliation mismatch: ${recon.delta}. Some transactions may be missing.`;
        }
        await setStage(upload_id_final, 'saving_results', 90);
      }

      // Save to database
      const statementExtract = await supabaseInsert('statement_extract', {
        upload_id: upload_id_final,
        guest_token: guest_token,
        period: freeSummary.period,
        transactions: normalized,
        free_summary: freeSummary,
        subscriptions: freeSummary.subscriptions || [],
        confidence: freeSummary.confidence ?? null,
        reconciliation: freeSummary.reconciliation ?? null,
        meta: {
          source: mime.includes('pdf') ? 'pdf' : 'image',
          tx_count: normalized.length,
          subscription_count: (freeSummary.subscriptions || []).length,
        },
      }, { single: true });

      if (!statementExtract) {
        throw new Error('Failed to save extract');
      }

      // Save subscription items to subscription_items table
      if (freeSummary.subscriptions && freeSummary.subscriptions.length > 0) {
        const subscriptionRecords = freeSummary.subscriptions.map((sub: any) => ({
          guest_token: guest_token,
          statement_extract_id: statementExtract.id,
          merchant: sub.merchant,
          normalized_merchant: normalizeMerchant(sub.merchant),
          amount: sub.amount,
          currency: 'SGD',
          interval: sub.interval,
          last_seen_date: new Date().toISOString().split('T')[0],
          next_expected_date: sub.nextExpectedDate,
          confidence: sub.confidence,
          source: 'statement',
          evidence: {},
        }));
        await supabaseInsert('subscription_items', subscriptionRecords).catch((err) => {
          console.warn('Failed to save subscription items (non-fatal):', err);
        });
      }

      // Update upload with statement_extract_id and mark as done
      hbStopped = true;
      if (hb) clearInterval(hb);
      
      await updateUpload(upload_id_final, {
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
          upload_id: upload_id_final,
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

      // Mark job as done
      await supabaseUpdate('jobs', {
        status: 'done',
      }, { id: job.id });

      console.log('Processing completed successfully:', {
        upload_id: upload_id_final,
        statement_extract_id: statementExtract.id,
      });

      return new Response(
        JSON.stringify({ ok: true, job_id: job.id, status: 'done', upload_id: upload_id_final }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      hbStopped = true;
      if (hb) clearInterval(hb);

      const message = error instanceof Error ? error.message : String(error);
      
      await supabaseUpdate('jobs', {
        status: 'error',
        last_error: message.slice(0, 900),
      }, { id: job.id });

      await updateUpload(upload_id_final, {
        status: 'error',
        processing_stage: 'error',
        progress: 100,
        error_message: message.slice(0, 900),
      });

      throw error;
    }

  } catch (err) {
    console.error('❌ process-job fatal:', err);
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, {
      status: 500,
      headers: { ...corsHeaders },
    });
  }
});
