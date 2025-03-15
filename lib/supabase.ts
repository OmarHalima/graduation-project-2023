import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a single instance of the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: 'app-supabase-auth',
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-v2'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    headers: {
      apikey: supabaseAnonKey
    }
  }
});

// Debug function to log session state
export const debugSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('Current Session State:', {
    hasSession: !!session,
    accessToken: session?.access_token ? `${session.access_token.substring(0, 10)}...` : 'none',
    tokenExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none',
    error: error?.message
  });
  return session;
};

// Create admin client with service key if available (with different storage key)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storage: localStorage,
        storageKey: 'app-supabase-admin-auth'
      },
      db: {
        schema: 'public'
      }
    })
  : null; // Return null if no service key is available 