import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-supabase-url.com"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key"

let cachedClient: ReturnType<typeof createSupabaseClient> | null = null

export const createClient = () => {
    if (cachedClient) return cachedClient
    cachedClient = createSupabaseClient(supabaseUrl, supabaseKey)
    return cachedClient
}
