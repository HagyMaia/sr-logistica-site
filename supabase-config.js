// ⚠️ ATENÇÃO: COLOQUE SUAS CHAVES DO SUPABASE AQUI ⚠️
// 1. Vá nas configurações do seu projeto Supabase > API
// 2. Copie a Project URL e cole na variável SUPABASE_URL
// 3. Copie a anon / public key e cole na variável SUPABASE_KEY

const SUPABASE_URL = 'https://lvdplhnbkkmlcxeuqhdo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CoC8vHLwAQ3kGsXwWBlaoA_4LB5SzsK';

// Inicializa o cliente do Supabase
// (O objeto supabase é disponibilizado globalmente pelo CDN carregado no HTML)
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
