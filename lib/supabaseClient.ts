import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zznzarpbntmvymtfapwx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bnphcnBibnRtdnltdGZhcHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MjA5OTAsImV4cCI6MjA4NjA5Njk5MH0.HTZRxem3QnwudEZEgZiOTlorNiptYZWh9c2uGiDhzkw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
