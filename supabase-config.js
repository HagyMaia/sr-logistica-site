// Configuração do Supabase para o Site Oficial da SR Logística
const SUPABASE_URL = 'https://lvdplhnbkkmlcxeuqhdo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CoC8vHLwAQ3kGsXwWBlaoA_4LB5SzsK';

// Inicializa o cliente Supabase de forma segura e global
const supabaseClient = (typeof window !== 'undefined' && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

window._srSupabase = supabaseClient;
