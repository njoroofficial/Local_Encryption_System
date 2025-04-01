import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const redirectUrl = process.env.REACT_APP_SUPABASE_REDIRECT_URL;

// create a supabase client with redirect URL for auth
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    redirectTo: redirectUrl,
    skipVerification: true,
  }
});

export default supabase;
