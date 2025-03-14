import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// middleware to check if user is authenticated
export const checkAuth = async (req, res, next) => {
  const supabase = createServerSupabase(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// middleware to verify jwt token
export const verifyJwt = async (req, res, next) => {
  const supabase = createServerSupabase(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};



// create a supabase server client
export const createServerSupabase = (req, res) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.headers.cookie;
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.setHeader('Set-Cookie', `${name}=${value}; ${options}`);
        });
      },
    },
  });
};