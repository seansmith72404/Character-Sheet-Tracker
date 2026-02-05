import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://kvqywrqchkdiyxjtpbvr.supabase.co'


const supabaseKey = 'sb_publishable_llIf69YGWUNROyWv96v5xA_8Wa80qm8'

export const supabase = createClient(supabaseUrl, supabaseKey)