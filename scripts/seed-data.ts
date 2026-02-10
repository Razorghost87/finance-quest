
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_USERS = [
    {
        email: 'alice@north.app', // The "Success" Case
        password: 'password123',
        role: 'premium',
        history: [
            { period_end: '2025-12-31', net_cashflow: 1200, confidence_score: 0.95 },
            { period_end: '2025-11-30', net_cashflow: 850, confidence_score: 0.92 },
            { period_end: '2025-10-31', net_cashflow: 400, confidence_score: 0.88 },
        ],
        subscriptions: [
            { merchant_name: 'Netflix', amount: 15.99, interval: 'monthly', confidence_score: 0.99 },
            { merchant_name: 'Spotify', amount: 9.99, interval: 'monthly', confidence_score: 0.99 },
        ]
    },
    {
        email: 'bob@north.app', // The "Drifting" Case
        password: 'password123',
        role: 'free',
        history: [
            { period_end: '2025-12-31', net_cashflow: -450, confidence_score: 0.65 },
            { period_end: '2025-11-30', net_cashflow: -200, confidence_score: 0.70 },
        ],
        subscriptions: [
            { merchant_name: 'Unknown Service', amount: 49.99, interval: 'monthly', confidence_score: 0.40 },
        ]
    }
];

async function seed() {
    console.log('🌱 Seeding North Data...');

    for (const u of TEST_USERS) {
        console.log(`Processing ${u.email}...`);

        // 1. Sign Up (or Sign In)
        let { data: authData, error: authError } = await supabase.auth.signUp({
            email: u.email,
            password: u.password
        });

        if (authError) {
            console.log(`  User exists or error: ${authError.message}. Trying sign in...`);
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: u.email,
                password: u.password
            });
            if (loginError) {
                console.error(`  Failed to access ${u.email}:`, loginError.message);
                continue;
            }
            authData = loginData;
        }

        const userId = authData.user?.id;
        if (!userId) {
            console.error('  No User ID found');
            continue;
        }

        console.log(`  User ID: ${userId}`);

        // 2. Set Profile Tier
        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({ id: userId, tier: u.role });

        if (profileError) console.error('  Profile Error:', profileError.message);
        else console.log(`  Set tier to ${u.role}`);

        // 3. Clear existing data to avoid dupes
        await supabase.from('north_star_metrics').delete().eq('user_id', userId);
        await supabase.from('subscriptions').delete().eq('user_id', userId);

        // 4. Insert History
        for (const h of u.history) {
            await supabase.from('north_star_metrics').insert({
                user_id: userId,
                period_end: h.period_end,
                net_cashflow: h.net_cashflow,
                confidence_score: h.confidence_score
            });
        }
        console.log(`  Inserted ${u.history.length} history records`);

        // 5. Insert Subscriptions
        for (const s of u.subscriptions) {
            await supabase.from('subscriptions').insert({
                user_id: userId,
                merchant_name: s.merchant_name,
                amount: s.amount,
                interval: s.interval,
                confidence_score: s.confidence_score,
                status: 'active'
            });
        }
        console.log(`  Inserted ${u.subscriptions.length} subscriptions`);
    }

    console.log('✅ Seeding Complete');
}

seed();
