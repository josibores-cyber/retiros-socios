import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzctrnhdmmmdsvklctey.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Y3RybmhkbW1tZHN2a2xjdGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjQ3MTcsImV4cCI6MjA5MDY0MDcxN30.ucZpitXjDI_DIS4SBH7bzSN97Cv2gsCT9_sDqRIhXKU';

export const supabase = createClient(supabaseUrl, supabaseKey);
