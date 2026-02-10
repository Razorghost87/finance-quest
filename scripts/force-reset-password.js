
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

async function resetPassword(email, newPassword) {
    console.log(`\n🔍 Looking up ${email}...`);

    // 1. Get User ID
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error("   ❌ Failed to list users:", listError.message);
        return;
    }

    const user = listData.users.find(u => u.email === email);

    if (!user) {
        console.log("   ⚠️ User not found. Creating fresh...");
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password: newPassword,
            email_confirm: true
        });
        if (error) console.error("   ❌ Create failed:", error.message);
        else console.log("   ✅ Created user with password:", newPassword);
        return;
    }

    // 2. Update Password & Confirm Email forcefully
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
        email_confirm: true,
        user_metadata: { email_verified: true }
    });

    if (updateError) {
        console.error("   ❌ Update failed:", updateError.message);
    } else {
        console.log("   ✅ Password FORCE RESET to:", newPassword);
        console.log("   ✅ Email confirmed.");
    }
}

async function main() {
    console.log("🔐 Force Resetting Test Accounts...");
    await resetPassword('alice_test@example.com', 'password123');
    await resetPassword('bob_test@example.com', 'password123');
    console.log("\n🏁 Done. Try logging in now.");
}

main();
