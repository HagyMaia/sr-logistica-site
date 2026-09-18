-- ==============================================================================
-- SR Logística & Transporte - Esquema Unificado Completo para Supabase
-- Tabelas: motoristas, passageiros, empresas_conveniadas, rides, posts
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELA: passageiros
-- ------------------------------------------------------------------------------
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
  foto_url text,
  avatar_url text,
  foto_status text DEFAULT 'Pendente',               -- 'Pendente', 'Aprovada', 'Rejeitada'
  payment_preference text DEFAULT 'VOUCHER',         -- 'VOUCHER', 'PIX', 'DINHEIRO', 'CARTAO'
  voucher_habilitado boolean DEFAULT false,          -- Liberado automaticamente quando status = 'Aprovado'
  origem text DEFAULT 'App Passageiro',
  status text NOT NULL DEFAULT 'Pendente',            -- 'Pendente' (Aguardando aprovação - somente PIX), 'Aprovado' (Voucher Liberado), 'Reprovado'
  motivo_rejeicao text,
  observacoes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS foto_status text DEFAULT 'Pendente';
ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS payment_preference text DEFAULT 'VOUCHER';
ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS voucher_habilitado boolean DEFAULT false;

ALTER TABLE public.passageiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de passageiros" ON public.passageiros;
CREATE POLICY "Permitir leitura de passageiros" ON public.passageiros FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao de passageiros" ON public.passageiros;
CREATE POLICY "Permitir insercao de passageiros" ON public.passageiros FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir atualizacao de passageiros" ON public.passageiros;
CREATE POLICY "Permitir atualizacao de passageiros" ON public.passageiros FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Permitir exclusao de passageiros" ON public.passageiros;
CREATE POLICY "Permitir exclusao de passageiros" ON public.passageiros FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 2. TABELA: motoristas
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.motoristas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  nome_social text,
  nome_completo text,
  cpf text,
  telefone text NOT NULL,
  email text,
  categoria_tipo text NOT NULL DEFAULT 'particular', -- 'particular' (Voucher + Particular) ou 'empresa' (Apenas Voucher)
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

ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS categoria_tipo text DEFAULT 'particular';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Particular';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS recebe_voucher boolean DEFAULT true;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS recebe_particular boolean DEFAULT true;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS foto_status text DEFAULT 'Pendente';

ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de motoristas" ON public.motoristas;
CREATE POLICY "Permitir leitura de motoristas" ON public.motoristas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao de motoristas" ON public.motoristas;
CREATE POLICY "Permitir insercao de motoristas" ON public.motoristas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir atualizacao de motoristas" ON public.motoristas;
CREATE POLICY "Permitir atualizacao de motoristas" ON public.motoristas FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Permitir exclusao de motoristas" ON public.motoristas;
CREATE POLICY "Permitir exclusao de motoristas" ON public.motoristas FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 3. TABELA: empresas_conveniadas
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresas_conveniadas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  trade_name text,
  cnpj text NOT NULL,
  contact_person text,
  phone text NOT NULL,
  email text,
  billing_cycle text NOT NULL DEFAULT 'quinzenal', -- 'quinzenal', 'mensal', 'semanal'
  active boolean NOT NULL DEFAULT true,
  address text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.empresas_conveniadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de empresas" ON public.empresas_conveniadas;
CREATE POLICY "Permitir leitura de empresas" ON public.empresas_conveniadas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao de empresas" ON public.empresas_conveniadas;
CREATE POLICY "Permitir insercao de empresas" ON public.empresas_conveniadas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir atualizacao de empresas" ON public.empresas_conveniadas;
CREATE POLICY "Permitir atualizacao de empresas" ON public.empresas_conveniadas FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Permitir exclusao de empresas" ON public.empresas_conveniadas;
CREATE POLICY "Permitir exclusao de empresas" ON public.empresas_conveniadas FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 4. TABELA: rides (Corridas / Viagens Corporativas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id uuid REFERENCES public.passageiros(id) ON DELETE SET NULL,
  passenger_name text,
  passenger_phone text,
  company text,
  driver_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  driver_name text,
  driver_vehicle text,
  pickup_address text NOT NULL,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text NOT NULL,
  dropoff_lat double precision,
  dropoff_lng double precision,
  fare_amount numeric(10,2) NOT NULL DEFAULT 0.00,
  distance_km numeric(10,2) DEFAULT 0.00,
  duration_min integer DEFAULT 0,
  status text NOT NULL DEFAULT 'COMPLETED', -- 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  payment_method text NOT NULL DEFAULT 'Voucher Corporativo', -- 'Voucher Corporativo', 'Dinheiro', 'PIX', 'Cartão'
  cancellation_reason text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de corridas" ON public.rides;
CREATE POLICY "Permitir leitura de corridas" ON public.rides FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao de corridas" ON public.rides;
CREATE POLICY "Permitir insercao de corridas" ON public.rides FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir atualizacao de corridas" ON public.rides;
CREATE POLICY "Permitir atualizacao de corridas" ON public.rides FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Permitir exclusao de corridas" ON public.rides;
CREATE POLICY "Permitir exclusao de corridas" ON public.rides FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 5. TABELA: posts (Comunicados e Atualizações)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  badge text DEFAULT 'AVISO',
  image_url text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de posts" ON public.posts;
CREATE POLICY "Permitir leitura de posts" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir escrita de posts" ON public.posts;
CREATE POLICY "Permitir escrita de posts" ON public.posts FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- 6. TABELA: solicitacoes_alteracao (Fluxo de Aprovação de Dados Sensíveis)
-- Regra Geral: Nenhum dado sensível ou empresa é alterado sem aprovação admin
-- Fluxo: Editar -> Enviar Análise -> Aguardando Aprovação -> Admin Aprova/Rejeita -> Atualiza Oficial
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitacoes_alteracao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_usuario text NOT NULL,                    -- 'passageiro' ou 'motorista'
  usuario_id uuid NOT NULL,                      -- ID na tabela passageiros ou motoristas
  usuario_nome text NOT NULL,
  tipo_alteracao text NOT NULL DEFAULT 'dados_cadastrais', -- 'empresa', 'categoria', 'foto', 'veiculo', 'dados_cadastrais'
  dados_anteriores jsonb NOT NULL DEFAULT '{}'::jsonb,     -- Snapshot dos dados oficiais vigentes
  dados_novos jsonb NOT NULL DEFAULT '{}'::jsonb,          -- Novos dados solicitados aguardando aprovação
  justificativa text,                                      -- Motivo informado pelo usuário
  status text NOT NULL DEFAULT 'Pendente',                 -- 'Pendente' (Aguardando aprovação), 'Aprovado', 'Rejeitado'
  motivo_rejeicao text,                                    -- Justificativa do administrador caso reprovado
  analisado_por text,                                      -- Identificação do administrador
  analisado_em timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS solicitacao_pendente boolean DEFAULT false;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS solicitacao_pendente boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON public.solicitacoes_alteracao(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_usuario ON public.solicitacoes_alteracao(usuario_id, tipo_usuario);

ALTER TABLE public.solicitacoes_alteracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de solicitacoes" ON public.solicitacoes_alteracao;
CREATE POLICY "Permitir leitura de solicitacoes" ON public.solicitacoes_alteracao FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao de solicitacoes" ON public.solicitacoes_alteracao;
CREATE POLICY "Permitir insercao de solicitacoes" ON public.solicitacoes_alteracao FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir atualizacao de solicitacoes" ON public.solicitacoes_alteracao;
CREATE POLICY "Permitir atualizacao de solicitacoes" ON public.solicitacoes_alteracao FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Permitir exclusao de solicitacoes" ON public.solicitacoes_alteracao;
CREATE POLICY "Permitir exclusao de solicitacoes" ON public.solicitacoes_alteracao FOR DELETE USING (true);

-- Função de Aprovação Automática
CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_alteracao(
  p_solicitacao_id uuid,
  p_admin_info text DEFAULT 'Administrador SR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_solicitacao record;
  v_novos jsonb;
BEGIN
  SELECT * INTO v_solicitacao FROM public.solicitacoes_alteracao WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;

  v_novos := v_solicitacao.dados_novos;

  IF v_solicitacao.tipo_usuario = 'passageiro' THEN
    UPDATE public.passageiros
    SET
      nome = COALESCE(v_novos->>'nome', nome),
      nome_social = COALESCE(v_novos->>'nome_social', nome_social),
      nome_completo = COALESCE(v_novos->>'nome_completo', nome_completo),
      telefone = COALESCE(v_novos->>'telefone', telefone),
      email = COALESCE(v_novos->>'email', email),
      cpf = COALESCE(v_novos->>'cpf', cpf),
      empresa = COALESCE(v_novos->>'empresa', empresa),
      setor = COALESCE(v_novos->>'setor', setor),
      matricula = COALESCE(v_novos->>'matricula', matricula),
      turno = COALESCE(v_novos->>'turno', turno),
      endereco = COALESCE(v_novos->>'endereco', endereco),
      foto_url = COALESCE(v_novos->>'foto_url', foto_url),
      avatar_url = COALESCE(v_novos->>'avatar_url', avatar_url),
      foto_status = CASE WHEN v_novos ? 'foto_url' THEN 'Aprovada' ELSE foto_status END,
      solicitacao_pendente = false,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_solicitacao.usuario_id;

  ELSIF v_solicitacao.tipo_usuario = 'motorista' THEN
    UPDATE public.motoristas
    SET
      nome = COALESCE(v_novos->>'nome', nome),
      nome_social = COALESCE(v_novos->>'nome_social', nome_social),
      nome_completo = COALESCE(v_novos->>'nome_completo', nome_completo),
      telefone = COALESCE(v_novos->>'telefone', telefone),
      email = COALESCE(v_novos->>'email', email),
      cpf = COALESCE(v_novos->>'cpf', cpf),
      categoria_tipo = COALESCE(v_novos->>'categoria_tipo', categoria_tipo),
      categoria = COALESCE(v_novos->>'categoria', categoria),
      recebe_voucher = COALESCE((v_novos->>'recebe_voucher')::boolean, recebe_voucher),
      recebe_particular = COALESCE((v_novos->>'recebe_particular')::boolean, recebe_particular),
      marca_veiculo = COALESCE(v_novos->>'marca_veiculo', marca_veiculo),
      modelo_veiculo = COALESCE(v_novos->>'modelo_veiculo', modelo_veiculo),
      placa_veiculo = COALESCE(v_novos->>'placa_veiculo', placa_veiculo),
      cor_veiculo = COALESCE(v_novos->>'cor_veiculo', cor_veiculo),
      foto_url = COALESCE(v_novos->>'foto_url', foto_url),
      avatar_url = COALESCE(v_novos->>'avatar_url', avatar_url),
      foto_status = CASE WHEN v_novos ? 'foto_url' THEN 'Aprovada' ELSE foto_status END,
      solicitacao_pendente = false,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_solicitacao.usuario_id;
  END IF;

  UPDATE public.solicitacoes_alteracao
  SET
    status = 'Aprovado',
    analisado_por = p_admin_info,
    analisado_em = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('success', true, 'message', 'Solicitação aprovada e dados oficiais atualizados.');
END;
$$;

-- Função de Rejeição
CREATE OR REPLACE FUNCTION public.rejeitar_solicitacao_alteracao(
  p_solicitacao_id uuid,
  p_motivo text,
  p_admin_info text DEFAULT 'Administrador SR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.solicitacoes_alteracao
  SET
    status = 'Rejeitado',
    motivo_rejeicao = p_motivo,
    analisado_por = p_admin_info,
    analisado_em = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('success', true, 'message', 'Solicitação rejeitada.');
END;
$$;

