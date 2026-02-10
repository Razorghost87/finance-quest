
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

async function monitor() {
    console.log("📡 Monitoring Recent Uploads & Jobs...\n");

    // 1. Get Recent Uploads
    const { data: uploads, error: upErr } = await supabase
        .from('upload')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (upErr) {
        console.error("❌ Failed to fetch uploads:", upErr.message);
        return;
    }

    if (uploads.length === 0) {
        console.log("⚠️ No uploads found.");
        return;
    }

    for (const u of uploads) {
        console.log(`📄 Upload: ${u.file_name} (${u.status})`);
        console.log(`   ID: ${u.id}`);
        console.log(`   Stage: ${u.processing_stage} | Progress: ${u.progress}%`);
        if (u.error_message) console.log(`   ❌ Error: ${u.error_message}`);

        // 2. Find Linked Job
        const { data: job } = await supabase
            .from('jobs')
            .select('*')
            .eq('upload_id', u.id)
            .single();

        if (job) {
            console.log(`   ⚙️ Job: ${job.status}`);
            console.log(`      ID: ${job.id}`);
            if (job.last_error) console.log(`      ❌ Job Error: ${job.last_error}`);
        } else {
            console.log(`   ⚠️ No Job linked yet.`);
        }

        // 3. Find Extract
        if (u.statement_extract_id) {
            const { data: extract } = await supabase
                .from('statement_extract')
                .select('*')
                .eq('id', u.statement_extract_id)
                .single();

            if (extract) {
                console.log(`   ✅ Extract Found!`);
                console.log(`      North Trajectory: ${extract.free_summary?.northStar?.trend}`);
            }
        }
        console.log("---------------------------------------------------");
    }
}

monitor();
