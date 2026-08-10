// ⚠️ ATENÇÃO: COLOQUE SUAS CHAVES DO SUPABASE AQUI ⚠️
// 1. Vá nas configurações do seu projeto Supabase > API
// 2. Copie a Project URL e cole na variável SUPABASE_URL
// 3. Copie a anon / public key e cole na variável SUPABASE_KEY

const SUPABASE_URL = 'SUA_SUPABASE_PROJECT_URL_AQUI';
const SUPABASE_KEY = 'SUA_SUPABASE_ANON_KEY_AQUI';

// Inicializa o cliente do Supabase
// (O objeto supabase é disponibilizado globalmente pelo CDN carregado no HTML)
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
