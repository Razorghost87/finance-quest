
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
const envConfig = fs.readFileSync(envPath, 'utf8');
envConfig.split(/\r?\n/).forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) process.env[key.trim()] = val.trim();
});

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function recreateUser(email, password, role) {
    console.log(`\n🔥 Nuking ${email}...`);

    // 1. Find User
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData.users.find(u => u.email === email);

    // 2. Delete if exists
    if (existing) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(existing.id);
        if (delErr) console.error(`   ❌ Delete failed: ${delErr.message}`);
        else console.log("   🗑️ Validated user deleted.");
    }

    // 3. Create Fresh
    console.log(`✨ Creating fresh ${email}...`);
    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role } // Store role in metadata for trigger
    });

    if (error) {
        console.error(`   ❌ Creation failed: ${error.message}`);
    } else {
        console.log(`   ✅ Success! ID: ${data.user.id}`);
        // Manually ensure profile exists (in case trigger fails or is slow)
        const { error: profileErr } = await supabase.from('user_profiles').upsert({
            id: data.user.id,
            email: email,
            tier: role
        });
        if (profileErr) console.log(`   ⚠️ Profile upsert warning: ${profileErr.message}`);
        else console.log(`   👤 Profile validated (${role})`);
    }
}

async function main() {
    console.log(`🎯 Targeting Supabase: ${SUPABASE_URL}`);
    await recreateUser('alice_test@example.com', 'password123', 'premium');
    await recreateUser('bob_test@example.com', 'password123', 'free');
    console.log("\n🏁 Complete. Please RESTART your App/Simulator.");
}

main();
