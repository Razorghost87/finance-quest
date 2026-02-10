
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// --- Robust .env parser ---
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '..', '.env');
        console.log('📂 Loading .env from:', envPath);

        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split(/\r?\n/);
            const loadedKeys = [];

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;

                const match = trimmed.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    process.env[key] = value;
                    loadedKeys.push(key);
                }
            });
            console.log('✅ Loaded keys:', loadedKeys.join(', '));
        } else {
            console.error('❌ .env file NOT found.');
        }
    } catch (e) {
        console.error('Error loading .env', e);
    }
}

loadEnv();

// Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Warn if using Anon Key for seeding
if (!SUPABASE_SERVICE_KEY && SUPABASE_ANON_KEY) {
    console.warn('\n⚠️  WARNING: Using ANON KEY. Seeding may fail if Email Confirmation is enabled in Supabase.');
    console.warn('   Add SUPABASE_SERVICE_ROLE_KEY to .env to bypass email verification.\n');
}

const targetKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !targetKey) {
    console.error('❌ Missing URL or KEY.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, targetKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const TEST_USERS = [
    {
        email: 'alice_test@example.com', // Changed to standard example.com
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
        email: 'bob_test@example.com',
        password: 'password123',
        role: 'free',
        history: [
            { period_end: '2025-12-31', net_cashflow: -450, confidence_score: 0.65 },
        ],
        subscriptions: [
            { merchant_name: 'Unknown Service', amount: 49.99, interval: 'monthly', confidence_score: 0.40 },
        ]
    }
];

async function seed() {
    console.log('🌱 Seeding North Data...');

    for (const u of TEST_USERS) {
        process.stdout.write(`Processing ${u.email}... `);

        // 1. Sign Up / Create User
        let userId;

        if (SUPABASE_SERVICE_KEY) {
            // ✅ Admin Way: Bypass verification
            process.stdout.write('   (Using Admin API)... ');

            // Try creating user
            const { data, error } = await supabase.auth.admin.createUser({
                email: u.email,
                password: u.password,
                email_confirm: true // Force confirmation
            });

            if (!error && data.user) {
                userId = data.user.id;
            } else {
                // User likely exists. Find ID via Admin API to preserve Service Role privileges.
                // (Signing in would demote our client to User scope, causing RLS errors)
                process.stdout.write('   User exists. Fetching ID... ');

                // Note: listUsers() might be paginated, but for seeding 2 users it's fine.
                const { data: listData, error: listError } = await supabase.auth.admin.listUsers();

                if (listError) {
                    console.log(`\n   ❌ Failed to list users: ${listError.message}`);
                    continue;
                }

                const found = listData.users.find(x => x.email === u.email);
                if (found) {
                    userId = found.id;
                } else {
                    console.log(`\n   ❌ Could not find user ${u.email} even though create failed.`);
                    continue;
                }
            }
        } else {
            // ⚠️ Public Way: Subject to verification
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: u.email,
                password: u.password
            });

            if (authError) {
                console.log(`\n   Sign Up Error: ${authError.message}`);
                // Try signing in
                const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                    email: u.email,
                    password: u.password
                });
                if (loginError) {
                    console.error(`   ❌ Failed to login: ${loginError.message}`);
                    continue;
                }
                userId = loginData.user?.id;
            } else {
                userId = authData.user?.id;
            }
        }

        if (!userId) {
            console.log('   ❌ No Session/User ID returned.');
            continue;
        }

        console.log(`✅ ID: ${userId}`);

        // 2. Set Profile
        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({ id: userId, tier: u.role });

        if (profileError) console.error('   ⚠️ Profile Error:', profileError.message);

        // 3. Clear & Insert Data
        // Note: With Anon Key, DELETE may fail due to RLS if not strictly matching user policy
        await supabase.from('north_star_metrics').delete().eq('user_id', userId);
        await supabase.from('subscriptions').delete().eq('user_id', userId);

        let histCount = 0;
        for (const h of u.history) {
            const { error } = await supabase.from('north_star_metrics').insert({
                user_id: userId,
                period_end: h.period_end,
                net_cashflow: h.net_cashflow,
                confidence_score: h.confidence_score
            });
            if (!error) histCount++;
        }

        let subCount = 0;
        for (const s of u.subscriptions) {
            const { error } = await supabase.from('subscriptions').insert({
                user_id: userId,
                merchant_name: s.merchant_name,
                amount: s.amount,
                interval: s.interval,
                confidence_score: s.confidence_score,
                status: 'active'
            });
            if (!error) subCount++;
        }
        console.log(`   Stats: ${histCount} history, ${subCount} subs inserted.`);
    }

    console.log('\n🏁 Script Complete.');
}

seed();
