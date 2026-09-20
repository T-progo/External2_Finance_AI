import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error('Missing Supabase URL environment variable');
    throw new Error('Missing Supabase URL environment variable. Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')
  }

  if (!serviceRoleKey) {
    console.error('Missing Supabase service role key environment variable');
    throw new Error('Missing Supabase service role key. Please set NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'apikey': serviceRoleKey,
      },
    },
  })
}

export const supabaseAdmin = getSupabaseAdminClient()
