-- ==============================================================================
-- SR Logística & Transporte - Script SQL para Tabela de Motoristas e Categorias
-- Execute este script no SQL Editor do seu painel Supabase (https://supabase.com)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Criação da Tabela de Motoristas (caso não exista)
CREATE TABLE IF NOT EXISTS public.motoristas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  nome_social text,
  nome_completo text,
  cpf text,
  telefone text NOT NULL,
  email text,
  categoria_tipo text NOT NULL DEFAULT 'particular', -- 'particular' ou 'empresa'
  categoria text NOT NULL DEFAULT 'Particular',      -- 'Particular' ou 'Empresa'
  recebe_voucher boolean NOT NULL DEFAULT true,       -- Ambos os tipos recebem voucher
  recebe_particular boolean NOT NULL DEFAULT true,    -- Empresa: false | Particular: true
  marca_veiculo text,
  modelo_veiculo text,
  placa_veiculo text,
  cor_veiculo text,
  ano_veiculo text,
  tipo_veiculo text DEFAULT 'Sedan / Hatch',
  status text NOT NULL DEFAULT 'Pendente',            -- 'Pendente', 'Aprovado', 'Reprovado'
  vehicle_status text DEFAULT 'Aprovado',
  cnh text,
  crlv text,
  foto_url text,
  avatar_url text,
  foto_status text DEFAULT 'Pendente',               -- 'Pendente', 'Aprovada', 'Rejeitada'
  observacoes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Garantir que as colunas de Categoria, Regra de Corridas e Fotos existam (caso a tabela já existisse)
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS categoria_tipo text DEFAULT 'particular';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Particular';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS recebe_voucher boolean DEFAULT true;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS recebe_particular boolean DEFAULT true;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS foto_status text DEFAULT 'Pendente';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 3. Atualizar motoristas existentes conforme a categoria
UPDATE public.motoristas 
SET 
  categoria_tipo = CASE 
    WHEN LOWER(categoria) = 'empresa' OR LOWER(categoria_tipo) = 'empresa' THEN 'empresa' 
    ELSE 'particular' 
  END,
  categoria = CASE 
    WHEN LOWER(categoria) = 'empresa' OR LOWER(categoria_tipo) = 'empresa' THEN 'Empresa' 
    ELSE 'Particular' 
  END,
  recebe_voucher = true,
  recebe_particular = CASE 
    WHEN LOWER(categoria) = 'empresa' OR LOWER(categoria_tipo) = 'empresa' THEN false 
    ELSE true 
  END;

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acesso RLS (Permissões completas para a aplicação web)
DROP POLICY IF EXISTS "Permitir leitura de motoristas" ON public.motoristas;
CREATE POLICY "Permitir leitura de motoristas"
  ON public.motoristas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de motoristas" ON public.motoristas;
CREATE POLICY "Permitir inserção de motoristas"
  ON public.motoristas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de motoristas" ON public.motoristas;
CREATE POLICY "Permitir atualização de motoristas"
  ON public.motoristas FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de motoristas" ON public.motoristas;
CREATE POLICY "Permitir exclusão de motoristas"
  ON public.motoristas FOR DELETE USING (true);

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_motoristas_status ON public.motoristas(status);
CREATE INDEX IF NOT EXISTS idx_motoristas_categoria_tipo ON public.motoristas(categoria_tipo);
CREATE INDEX IF NOT EXISTS idx_motoristas_created_at ON public.motoristas(created_at DESC);

-- 7. Função SQL para buscar motoristas elegíveis para determinada corrida/forma de pagamento
-- Regra de Negócio:
--   - Se a corrida for 'Voucher' / 'Voucher Corporativo': Ambos os motoristas (empresa e particular) são elegíveis.
--   - Se a corrida for 'Particular' / 'Dinheiro' / 'PIX' / 'Cartão': APENAS motoristas com categoria 'particular' são elegíveis.
CREATE OR REPLACE FUNCTION public.get_motoristas_elegiveis_corrida(p_payment_method text)
RETURNS SETOF public.motoristas AS $$
BEGIN
  IF LOWER(p_payment_method) LIKE '%voucher%' OR LOWER(p_payment_method) LIKE '%convenio%' OR LOWER(p_payment_method) LIKE '%empresa%' THEN
    -- Voucher: Ambos recebem (Frota Empresa e Particular)
    RETURN QUERY 
      SELECT * FROM public.motoristas 
      WHERE status = 'Aprovado' AND recebe_voucher = true;
  ELSE
    -- Particular / Dinheiro / PIX / Cartão: Apenas Motorista Particular recebe
    RETURN QUERY 
      SELECT * FROM public.motoristas 
      WHERE status = 'Aprovado' AND categoria_tipo = 'particular' AND recebe_particular = true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
