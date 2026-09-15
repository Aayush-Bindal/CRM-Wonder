import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseConfig = () => {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem('estateflow_supabase_url');
    const savedKey = localStorage.getItem('estateflow_supabase_anon_key');
    if (savedUrl && savedKey) {
      return { url: savedUrl, key: savedKey, isCustom: true };
    }
  }

  if (envUrl && envKey && !envUrl.includes('your-project')) {
    return { url: envUrl, key: envKey, isCustom: false };
  }

  return { url: '', key: '', isCustom: false };
};

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config.url || !config.key) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseInstance;
};

export const setCustomSupabaseConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    if (url && key) {
      localStorage.setItem('estateflow_supabase_url', url);
      localStorage.setItem('estateflow_supabase_anon_key', key);
    } else {
      localStorage.removeItem('estateflow_supabase_url');
      localStorage.removeItem('estateflow_supabase_anon_key');
    }
    supabaseInstance = null; // reset instance
  }
};
