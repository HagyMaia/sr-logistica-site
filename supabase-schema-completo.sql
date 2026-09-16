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
  origem text DEFAULT 'App Passageiro',
  status text NOT NULL DEFAULT 'Pendente', -- 'Pendente', 'Aprovado', 'Reprovado'
  motivo_rejeicao text,
  observacoes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

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
  observacoes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS categoria_tipo text DEFAULT 'particular';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Particular';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS recebe_voucher boolean DEFAULT true;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS recebe_particular boolean DEFAULT true;

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
