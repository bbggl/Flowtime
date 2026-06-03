import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function createDummyClient(): SupabaseClient {
  const mockUser = {
    id: 'demo-user',
    email: 'demo@flowtime.app',
    user_metadata: { name: 'Demo' },
    app_metadata: {},
    aud: '',
    created_at: '',
    role: '',
  }
  const mockAuth = {
    getSession: () =>
      Promise.resolve({ data: { session: { user: mockUser } }, error: null }) as any,
    onAuthStateChange: () =>
      ({ data: { subscription: { unsubscribe: () => {} } } }) as any,
    signUp: () =>
      Promise.resolve({ data: { user: mockUser, session: null }, error: null }) as any,
    signInWithPassword: () =>
      Promise.resolve({ data: { user: mockUser, session: {} }, error: null }) as any,
    signOut: () => Promise.resolve({ error: null }),
  }
  const mockQueryBuilder = {
    select: () => mockQueryBuilder,
    insert: () => mockQueryBuilder,
    update: () => mockQueryBuilder,
    delete: () => mockQueryBuilder,
    eq: () => mockQueryBuilder,
    order: () => mockQueryBuilder,
    limit: () => mockQueryBuilder,
    single: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  }

  return {
    auth: mockAuth,
    from: () => mockQueryBuilder,
  } as unknown as SupabaseClient
}

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createDummyClient()
