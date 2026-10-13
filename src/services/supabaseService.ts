import { createClient } from "@supabase/supabase-js";
// Initialize the Supabase Client
const envUrl = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_SUPABASE_URL : process.env.VITE_SUPABASE_URL;
const supabaseUrl = envUrl && envUrl.startsWith('http') ? envUrl.trim() : 'https://oujijpepbkqpgzgegoqf.supabase.co';

const envKey = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_SUPABASE_ANON_KEY : process.env.VITE_SUPABASE_ANON_KEY;
const supabaseKey = envKey && envKey.trim().length > 0 && envKey !== 'undefined' ? envKey.trim() : 'sb_publishable_zQKul9e9MeAZXi0wH48yCw_AmlQ0rXo';

// Check for service role key for write operations
const envServiceKey = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_SUPABASE_SERVICE_KEY : process.env.VITE_SUPABASE_SERVICE_KEY;
const supabaseServiceKey = envServiceKey && envServiceKey.trim().length > 0 && envServiceKey !== 'undefined' ? envServiceKey.trim() : null;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    },
    global: {
      fetch: async (url, options) => {
        try {
          return await fetch(url, options);
        } catch (err: any) {
          const urlStr = typeof url === 'string' ? url : (url as any)?.url || '';
          if (urlStr.includes('/auth/v1/')) {
            // Rethrow so Supabase Auth handles offline network connectivity properly
            // without interpreting an artificial 502 HTTP response as a token revocation
            throw err;
          }
          console.warn("[Supabase Custom Fetch] Failed:", url, err);
          return new Response(JSON.stringify({ error: err.message || 'Fetch failed' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
);

// Admin client with service role key for write operations (INSERT/UPDATE/DELETE)
// Falls back to anon client if service key not available (read-only mode)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        fetch: async (url, options) => {
          try {
            return await fetch(url, options);
          } catch (err: any) {
            console.warn("[Supabase Admin Fetch] Failed:", url, err);
            return new Response(JSON.stringify({ error: err.message || 'Fetch failed' }), {
              status: 502,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      }
    })
  : supabase;

// We define our core migration adapters here to transition smoothly from Appwrite

export const supabaseAuthService = {
  async register(email: string, pass: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: name
        }
      }
    });
    if (error) throw error;
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error("Account already exists. Please go to Login or use a different phone/email.");
    }
    return data.user;
  },

  async login(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });
    if (error) throw error;
    return data.user;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    try {
      const urlUser = await handleUrlAuth();
      if (urlUser) return urlUser;
    } catch (e) {
      console.warn("[Supabase Auth] handleUrlAuth failed:", e);
    }
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) return null;
      return session?.user ?? null;
    } catch (err) {
      console.warn("[Supabase Auth] getSession error (offline/transport):", err);
      return null;
    }
  }
};

async function handleUrlAuth() {
  if (typeof window === 'undefined') return null;

  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    const extractParam = (str: string, key: string): string | null => {
      const regex = new RegExp(`[#?&]${key}=([^&#]*)`, 'i');
      const match = str.match(regex);
      return match ? decodeURIComponent(match[1]) : null;
    };

    accessToken = extractParam(hash, 'access_token') || extractParam(search, 'access_token');
    refreshToken = extractParam(hash, 'refresh_token') || extractParam(search, 'refresh_token');

    if (accessToken) {
      console.log("[Supabase Auth] Found access token in URL, initializing session...");
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || ""
      });

      if (error) {
        console.error("[Supabase Auth] Failed to restore session from URL tokens:", error.message);
      } else if (data && data.user) {
        console.log("[Supabase Auth] Successfully authenticated user from URL token:", data.user.email);
        
        try {
          const cleanHash = window.location.hash
            .replace(/[#&]access_token=[^&]*/, '')
            .replace(/[&]refresh_token=[^&]*/, '')
            .replace(/[&]expires_in=[^&]*/, '')
            .replace(/[&]expires_at=[^&]*/, '')
            .replace(/[&]token_type=[^&]*/, '')
            .replace(/[&]type=[^&]*/, '')
            .replace(/[&]sb=[^&]*/, '');
          
          const finalHash = (cleanHash === '#' || cleanHash === '') ? '' : cleanHash;
          const cleanSearch = window.location.search
            .replace(/[?&]access_token=[^&]*/, '')
            .replace(/[&]refresh_token=[^&]*/, '')
            .replace(/[&]expires_in=[^&]*/, '')
            .replace(/[&]expires_at=[^&]*/, '')
            .replace(/[&]token_type=[^&]*/, '')
            .replace(/[&]type=[^&]*/, '')
            .replace(/[&]sb=[^&]*/, '');

          const searchPrefix = cleanSearch.startsWith('&') ? '?' + cleanSearch.substring(1) : cleanSearch;
          
          window.history.replaceState(null, '', window.location.pathname + searchPrefix + finalHash);
        } catch (urlErr) {
          console.warn("[Supabase Auth] Failed to clean URL:", urlErr);
        }
        
        return data.user;
      }
    }
  } catch (err) {
    console.error("[Supabase Auth] Error parsing URL auth:", err);
  }
  return null;
}

export const supabaseDbService = {
  async getProfile(userId: string) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return data;
  },

  async upsertProfile(profile: any) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(profile, { onConflict: 'user_id' });
    if (error) throw error;
  }
};

// Expose channels for realtime events, replacing Appwrite subscriptions
export const supabaseRealtime = {
  subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
    const channelName = `messages:${conversationId || 'all'}:${Math.random().toString(36).substring(7)}`;
    const changeOptions: any = { event: '*', schema: 'public', table: 'messages' };
    if (conversationId && conversationId !== '*') {
      changeOptions.filter = `conversation_id=eq.${conversationId}`;
    }
    return supabase
      .channel(channelName)
      .on('postgres_changes', changeOptions, callback)
      .subscribe();
  }
};

export const getSupabase = () => supabase;
export const getSupabaseAdmin = () => supabaseAdmin;

