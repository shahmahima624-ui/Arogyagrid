import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jlawyepfvxeofugczdxu.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYXd5ZXBmdnhlb2Z1Z2N6ZHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzk5NjEsImV4cCI6MjEwMjkxNTk2MX0.CxhyrQyLhGPo6ilfp78REvrHeNN3ERb1UN-BGXfbXUA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
