// Configuração do Supabase para o Site Oficial da SR Logística
(function () {
  const SUPABASE_URL = 'https://lvdplhnbkkmlcxeuqhdo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_CoC8vHLwAQ3kGsXwWBlaoA_4LB5SzsK';

  if (typeof window !== 'undefined') {
    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_KEY = SUPABASE_KEY;

    if (window.supabase && !window.supabaseClient) {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
      });
    }
    window._srSupabase = window.supabaseClient;
  }
})();
