import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://camqdxoawsklpjiqyzpt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbXFkeG9hd3NrbHBqaXF5enB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMzg4NjEsImV4cCI6MjA2MzkxNDg2MX0.KR7HNQmTcq-z4GkiSmIWzTgH_DjHoju9TDfVE1QMHM0'

export const supabase = createClient(supabaseUrl, supabaseKey)