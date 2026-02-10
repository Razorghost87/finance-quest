
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
const keyArg = process.argv[2];

if (!keyArg) {
    console.log(`
Usage: node scripts/setup-env.js <SUPABASE_SERVICE_ROLE_KEY>

This script will add your Service Role Key to the .env file safely.
You can find this key in your Supabase Dashboard:
> Project Settings > API > service_role (secret)
`);
    process.exit(1);
}

try {
    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf8');
    } else {
        console.log('Creating new .env file...');
    }

    // Check if key already exists
    if (content.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        console.log('Updating existing SUPABASE_SERVICE_ROLE_KEY...');
        const lines = content.split(/\r?\n/);
        const newLines = lines.map(line => {
            if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
                return `SUPABASE_SERVICE_ROLE_KEY=${keyArg}`;
            }
            return line;
        });
        content = newLines.join('\n');
    } else {
        console.log('Appending SUPABASE_SERVICE_ROLE_KEY...');
        // Ensure newline before appending if file not empty
        if (content && !content.endsWith('\n')) {
            content += '\n';
        }
        content += `SUPABASE_SERVICE_ROLE_KEY=${keyArg}\n`;
    }

    fs.writeFileSync(envPath, content);
    console.log('✅ .env updated successfully!');
    console.log('Now you can run: node scripts/seed-data.js');

} catch (e) {
    console.error('Failed to update .env:', e);
}
