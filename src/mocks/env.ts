const envUrl = import.meta.env.VITE_SUPABASE_URL;
export const PUBLIC_SUPABASE_URL = (envUrl && envUrl.startsWith('http') ? envUrl.trim() : 'https://oujijpepbkqpgzgegoqf.supabase.co') as string;

const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const PUBLIC_SUPABASE_PUBLISHABLE_KEY = (envKey && envKey.trim().length > 0 && envKey !== 'undefined' ? envKey.trim() : 'sb_publishable_zQKul9e9MeAZXi0wH48yCw_AmlQ0rXo') as string;
