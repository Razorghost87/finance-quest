// detect-subscriptions/index.ts
// Intelligent agent to find recurring payments

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

// Environment variables
const SUPABASE_PROJECT_URL = Deno.env.get('SUPABASE_PROJECT_URL') || Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Setup Supabase client
const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_KEY);

interface Transaction {
    description: string;
    amount: number;
    date: string;
    currency: string;
}

interface SubscriptionCandidate {
    merchant_name: string;
    amount: number;
    interval: string;
    confidence: number;
    last_date: string;
}

// Helper: Simple similarity check (Levenshtein distance proxy)
function isSimilar(a: string, b: string): boolean {
    if (a.includes(b) || b.includes(a)) return true;
    return false; // TODO: Implement fuzzy matching
}

// Helper: Normalize description
function normalize(desc: string): string {
    return desc.toLowerCase()
        .replace(/dhl/g, '') // remove common garbage
        .replace(/payment/g, '')
        .trim();
}

Deno.serve(async (req: Request) => {
    try {
        const { upload_id, guest_token } = await req.json();

        if (!upload_id) return new Response("Missing upload_id", { status: 400 });

        console.log(`🕵️ Detecting subscriptions for Upload ${upload_id}`);

        // 1. Fetch transactions for this upload
        const { data: transactions, error } = await supabase
            .from('transaction_extract')
            .select('*')
            .eq('upload_id', upload_id);

        if (error || !transactions) throw error || new Error("No transactions found");

        // 2. Logic: Group by (normalized_desc + amount)
        const groups: Record<string, Transaction[]> = {};

        transactions.forEach((t: any) => {
            // filter out positive (income) or very small amounts
            if (t.amount >= 0 || Math.abs(t.amount) < 2) return;

            const key = `${normalize(t.description)}_${Math.abs(t.amount)}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });

        const candidates: SubscriptionCandidate[] = [];

        // 3. Analyze Patterns
        for (const key in groups) {
            const group = groups[key];
            // Only interested if we see it more than once (or if it's a known subscription service - advanced)
            // For a single month statement, we might only see it once. 
            // Strategy: If 1 month data, check if it matches a "Known Subscription Database" (Netflix, Spotify, etc)
            // For now, let's implement the "Known List" heuristic + Frequency

            const desc = normalize(group[0].description);
            const amount = Math.abs(group[0].amount);

            const knownSubs = ['netflix', 'spotify', 'adobe', 'apple', 'google storage', 'linkedin', 'chatgpt', 'openai', 'aws', 'heroku'];
            const isKnown = knownSubs.some(k => desc.includes(k));

            if (group.length > 1) {
                candidates.push({
                    merchant_name: group[0].description,
                    amount: amount,
                    interval: 'unknown', // usually monthly
                    confidence: 0.9,
                    last_date: group[group.length - 1].date
                });
            } else if (isKnown) {
                candidates.push({
                    merchant_name: group[0].description,
                    amount: amount,
                    interval: 'monthly',
                    confidence: 0.7, // Only saw it once, but it's Netflix
                    last_date: group[0].date
                });
            }
        }

        console.log(`✅ Found ${candidates.length} candidates`);

        // 4. Save to Subscriptions Table
        if (candidates.length > 0) {
            const payload = candidates.map(c => ({
                user_id: null, // guest
                guest_token: guest_token,
                merchant_name: c.merchant_name,
                amount: c.amount,
                interval: c.interval,
                confidence_score: c.confidence,
                status: 'active'
            }));

            const { error: insertErr } = await supabase.from('subscriptions').insert(payload);
            if (insertErr) throw insertErr;
        }

        return new Response(JSON.stringify({ success: true, count: candidates.length }), { headers: { "Content-Type": "application/json" } });

    } catch (e: any) {
        console.error("Detection failed:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
});
