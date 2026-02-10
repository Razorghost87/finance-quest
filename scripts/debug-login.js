
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
    console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY. Run `node scripts/setup-env.js <KEY>` first.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUser(email) {
    console.log(`\n🔍 Inspecting ${email}...`);

    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error("   ❌ API Error:", listError.message);
        return;
    }

    const user = listData.users.find(u => u.email === email);

    if (!user) {
        console.log("   ❌ User DOES NOT EXIST in Auth table.");
    } else {
        console.log("   ✅ User Exists");
        console.log(`      ID: ${user.id}`);
        console.log(`      Confirmed At: ${user.email_confirmed_at ? '✅ ' + user.email_confirmed_at : '❌ NULL (Unconfirmed)'}`);
        console.log(`      Last Sign In: ${user.last_sign_in_at}`);

        // Check Profile
        const { data: profile, error: profileErr } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileErr) console.log("      ⚠️ Profile Missing/Error:", profileErr.message);
        else console.log(`      Profile Tier: ${profile.tier}`);
    }
}

async function main() {
    console.log("🕵️ Login Debugger");
    await checkUser('alice_test@example.com');
    await checkUser('bob_test@example.com');
}

main();
