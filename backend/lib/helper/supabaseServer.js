import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in environment variables.');
  console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in your .env file.');
}

// Create the Supabase client
const createServerSupabase = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false
    }
  });
};

// middleware to check if user is authenticated
export const checkAuth = async (req, res, next) => {
  try {
    const supabase = createServerSupabase();
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    
    req.user = data.user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Server error during authentication' });
  }
};

// middleware to verify jwt token (functionally similar to checkAuth, but kept for compatibility)
export const verifyJwt = async (req, res, next) => {
  try {
    const supabase = createServerSupabase();
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    
    req.user = data.user;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(500).json({ error: 'Server error during token verification' });
  }
};

// Export the server supabase client creator
export { createServerSupabase };