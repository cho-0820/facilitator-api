/**
 * scripts/create-storage-bucket.ts
 * Creates the 'project-assets' private Supabase Storage bucket.
 * Run once: npx tsx scripts/create-storage-bucket.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

(async () => {
    const BUCKET = 'project-assets';

    // Check if bucket already exists
    const { data: existing } = await supabase.storage.getBucket(BUCKET);
    if (existing) {
        console.log(`Bucket '${BUCKET}' already exists. Skipping creation.`);
        process.exit(0);
    }

    const { data, error } = await supabase.storage.createBucket(BUCKET, {
        public: false, // private bucket — no public URL access
    });

    if (error) {
        console.error('Failed to create bucket:', error.message);
        process.exit(1);
    }

    console.log(`✅ Bucket '${BUCKET}' created successfully (private).`);
    console.log('Bucket data:', data);
})();
