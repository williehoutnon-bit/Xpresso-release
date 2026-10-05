import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://oujijpepbkqpgzgegoqf.supabase.co';
const supabaseKey = 'sb_publishable_zQKul9e9MeAZXi0wH48yCw_AmlQ0rXo';

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

async function checkRealtime() {
  try {
    // We cannot run direct raw SQL query on Supabase unless we have an RPC function.
    // Let's check what channels we can subscribe to, or if we can query some metadata tables via API if accessible.
    // Let's see if we can do a request to supabase Admin or check if there is an error.
    console.log("Checking if we can connect to Supabase and subscribe...");
    
    // Let's try to fetch some rows from 'presence'
    const { data: presence, error: pErr } = await supabaseAdmin.from('presence').select('*');
    if (pErr) {
      console.error("Error fetching presence:", pErr);
    } else {
      console.log("Presence rows:", presence);
    }
  } catch (error) {
    console.error("Check failed:", error);
  }
}

checkRealtime();
