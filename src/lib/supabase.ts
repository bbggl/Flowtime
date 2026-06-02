import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function createDummyClient() {
  const mockUser = {
    id: 'demo-user',
    email: 'demo@flowtime.app',
    user_metadata: { name: 'Demo' },
    app_metadata: {},
    aud: '',
    created_at: '',
  }
  return {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: mockUser } }, error: null }) as any,
      onAuthStateChange: () =>
        ({ data: { subscription: { unsubscribe: () => {} } } }) as any,
      signUp: (_credentials: { email: string; password: string }) =>
        Promise.resolve({ data: { user: mockUser }, error: null }) as any,
      signInWithPassword: (_credentials: { email: string; password: string }) =>
        Promise.resolve({ data: { user: mockUser }, error: null }) as any,
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
  } as any
}

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createDummyClient()
