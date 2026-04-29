import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rzctrnhdmmmdsvklctey.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Y3RybmhkbW1tZHN2a2xjdGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MjY5NzMsImV4cCI6MjA1OTEwMjk3M30.eyJpc3MiOiJzdXBhYmFzZSJ9';

export const supabase = createClient(supabaseUrl, supabaseKey);
