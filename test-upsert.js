import { supabaseAdmin } from './src/services/supabaseService.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function test() {
  const userId = '12345';
  const nowStr = new Date().toISOString();
  
  const { error } = await supabaseAdmin.from('presence').upsert({
    user_id: userId,
    is_online: true,
    last_seen_at: nowStr,
    updated_at: nowStr
  }, { onConflict: 'user_id' });
  
  console.log('Error from presence upsert:', error?.message);
}

test();
