-- ==============================================================================
-- SR Logística - Script de Criação da Tabela de Passageiros para o Supabase
-- Execute este script no SQL Editor do seu painel Supabase
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.passageiros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  nome_social text,
  nome_completo text,
  cpf text,
  telefone text NOT NULL,
  email text,
  empresa text NOT NULL,
  setor text,
  matricula text,
  turno text,
  endereco text,
  origem text DEFAULT 'App Passageiro',
  status text NOT NULL DEFAULT 'Pendente', -- 'Pendente', 'Aprovado', 'Reprovado'
  motivo_rejeicao text,
  observacoes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.passageiros ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS "Permitir cadastro de passageiros via app" ON public.passageiros;
CREATE POLICY "Permitir cadastro de passageiros via app"
  ON public.passageiros FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura de passageiros" ON public.passageiros;
CREATE POLICY "Permitir leitura de passageiros"
  ON public.passageiros FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir atualização de passageiros" ON public.passageiros;
CREATE POLICY "Permitir atualização de passageiros"
  ON public.passageiros FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de passageiros" ON public.passageiros;
CREATE POLICY "Permitir exclusão de passageiros"
  ON public.passageiros FOR DELETE USING (true);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_passageiros_status ON public.passageiros(status);
CREATE INDEX IF NOT EXISTS idx_passageiros_created_at ON public.passageiros(created_at DESC);
