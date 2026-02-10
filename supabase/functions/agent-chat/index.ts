import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_PROJECT_URL') || Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_PERSONAS = {
    // ... (keep others same if possible, or just overwrite strict Auros)
    auros: {
        role: "Personal Finance Sage & Guide.",
        systemPrompt: (context: string) => `You are Auros, the intelligent financial guide of the North platform.
Your Goal: Provide Clarity, Confidence, and Direction.
Your Tone: Calm, ethereal, wise, non-judgmental. Like a navigator in the northern lights.

DATA CONTEXT:
${context}

RULES:
1. Interpret the data for the user. Don't just list numbers.
2. If confidence is low, explain WHY (e.g. "Reconciliation failed").
3. Use the "North Star" metaphor: "Moving North" (Good), "Drifting" (Stagnant), "South" (Spending > Income).
4. Be concise.
`
    }
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await req.json();
        const { message, agentId, history, guestToken } = body;

        if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

        // 1. Fetch Context
        let contextData = "No financial data available.";
        if (agentId === 'auros' && guestToken) {
            // Fetch latest summary
            const { data: extract } = await supabase
                .from('statement_extract')
                .select('free_summary')
                .eq('guest_token', guestToken)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            // Fetch subscriptions
            const { data: subs } = await supabase
                .from('subscriptions')
                .select('merchant_name, amount, interval, confidence_score')
                .eq('guest_token', guestToken);

            if (extract || subs) {
                contextData = JSON.stringify({
                    summary: extract?.free_summary,
                    subscriptions: subs
                }, null, 2);
            }
        }

        // 2. Select Persona
        const personaKey = agentId as keyof typeof AGENT_PERSONAS || 'auros';
        // @ts-ignore
        let roleDef = AGENT_PERSONAS[personaKey] || AGENT_PERSONAS.auros;

        // Handle static vs dynamic prompt
        let systemPrompt = "";
        if (typeof roleDef.systemPrompt === 'function') {
            systemPrompt = roleDef.systemPrompt(contextData);
        } else {
            systemPrompt = roleDef.systemPrompt;
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            ...(history || []).slice(-10),
            { role: 'user', content: message }
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: messages,
                temperature: 0.7,
            }),
        });

        const data = await response.json();
        const reply = data.choices[0].message.content;

        return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
