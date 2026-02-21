import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'AquiVaLaURLDelProyecto';
const supabaseAnonKey = 'AcaVaLAanonKeyDelProyecto';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
