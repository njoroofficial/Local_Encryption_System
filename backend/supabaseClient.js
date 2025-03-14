import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Regular client with anon key (for client-side operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Service role client for admin operations (server-side only)
// This will have full access to bypass RLS policies
const serviceClient = process.env.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export { supabase, serviceClient };

// Test Supabase connection on startup
const testSupabaseConnection = async () => {
  try {
    // Use a more general method to test the connection without relying on specific tables
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Supabase connection test failed:', error.message);
    } else {
      console.log('Supabase connection established successfully.');
    }
  } catch (err) {
    console.error('Error testing Supabase connection:', err.message);
  }
};

// Run connection test
testSupabaseConnection(); 