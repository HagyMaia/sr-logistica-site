-- ==============================================================================
-- SR Logística & Transporte - Regra Geral de Gestão Cadastral & Fonte Única
-- ==============================================================================
-- Regra Geral do Sistema:
-- Nenhum dado cadastral sensível ou informação de empresa deve ser alterado
-- diretamente pelo usuário após o cadastro.
--
-- Fluxo Obrigatório:
-- 1. Usuário solicita edição no App/Site
-- 2. Envio para análise (criação de registro em solicitacoes_alteracao)
-- 3. Status "Aguardando aprovação" (dados oficiais permanecem inalterados)
-- 4. Administrador aprova ou rejeita no Painel Admin
-- 5. Se aprovado: atualização automática dos dados oficiais
--
-- Fonte de Dados Compartilhada:
-- Site Administrativo, App Motorista e App Passageiro consom as mesmas tabelas
-- do Supabase (passageiros, motoristas, empresas_conveniadas, solicitacoes_alteracao, rides).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELA DE SOLICITAÇÕES DE ALTERAÇÃO CADASTRAL
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
  analisado_por text,                                      -- Nome/ID do admin que realizou a análise
  analisado_em timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Garantir colunas essenciais
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS tipo_usuario text DEFAULT 'passageiro';
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS usuario_id uuid;
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS usuario_nome text;
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS tipo_alteracao text DEFAULT 'dados_cadastrais';
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS dados_anteriores jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS dados_novos jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS justificativa text;
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pendente';
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS motivo_rejeicao text;
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS analisado_por text;
ALTER TABLE public.solicitacoes_alteracao ADD COLUMN IF NOT EXISTS analisado_em timestamp with time zone;

-- Índices para alta performance nas consultas do admin e dos apps
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON public.solicitacoes_alteracao(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_usuario ON public.solicitacoes_alteracao(usuario_id, tipo_usuario);

-- ------------------------------------------------------------------------------
-- 2. AJUSTE DE COLUNAS DE CONTROLE NAS TABELAS PRINCIPAIS
-- ------------------------------------------------------------------------------
ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS solicitacao_pendente boolean DEFAULT false;
ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS foto_status text DEFAULT 'Pendente';
ALTER TABLE public.passageiros ADD COLUMN IF NOT EXISTS voucher_habilitado boolean DEFAULT false;

ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS solicitacao_pendente boolean DEFAULT false;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS foto_status text DEFAULT 'Pendente';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS categoria_tipo text DEFAULT 'particular';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Particular';
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS recebe_voucher boolean DEFAULT true;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS recebe_particular boolean DEFAULT true;

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS DE SEGURANÇA RLS (Row Level Security)
-- ------------------------------------------------------------------------------
ALTER TABLE public.solicitacoes_alteracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de solicitacoes" ON public.solicitacoes_alteracao;
CREATE POLICY "Permitir leitura de solicitacoes" ON public.solicitacoes_alteracao FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao de solicitacoes" ON public.solicitacoes_alteracao;
CREATE POLICY "Permitir insercao de solicitacoes" ON public.solicitacoes_alteracao FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de solicitacoes" ON public.solicitacoes_alteracao;
CREATE POLICY "Permitir atualizacao de solicitacoes" ON public.solicitacoes_alteracao FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusao de solicitacoes" ON public.solicitacoes_alteracao;
CREATE POLICY "Permitir exclusao de solicitacoes" ON public.solicitacoes_alteracao FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 4. FUNÇÕES ATÔMICAS DE APROVAÇÃO E REJEIÇÃO (RPC)
-- ------------------------------------------------------------------------------

-- Função para Aprovar Solicitação e Atualizar Automaticamente os Dados Oficiais
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
  -- 1. Buscar a solicitação
  SELECT * INTO v_solicitacao FROM public.solicitacoes_alteracao WHERE id = p_solicitacao_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;

  v_novos := v_solicitacao.dados_novos;

  -- 2. Atualizar dados oficiais na tabela de destino
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
      foto_status = CASE 
                      WHEN v_novos ? 'foto_url' THEN 'Aprovada'
                      ELSE foto_status
                    END,
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
      foto_status = CASE 
                      WHEN v_novos ? 'foto_url' THEN 'Aprovada'
                      ELSE foto_status
                    END,
      solicitacao_pendente = false,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_solicitacao.usuario_id;
  END IF;

  -- 3. Atualizar status da solicitação para Aprovado
  UPDATE public.solicitacoes_alteracao
  SET
    status = 'Aprovado',
    analisado_por = p_admin_info,
    analisado_em = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('success', true, 'message', 'Solicitação aprovada e dados oficiais atualizados com sucesso.');
END;
$$;

-- Função para Rejeitar Solicitação de Alteração
CREATE OR REPLACE FUNCTION public.rejeitar_solicitacao_alteracao(
  p_solicitacao_id uuid,
  p_motivo text,
  p_admin_info text DEFAULT 'Administrador SR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_solicitacao record;
BEGIN
  SELECT * INTO v_solicitacao FROM public.solicitacoes_alteracao WHERE id = p_solicitacao_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;

  -- 1. Marcar a solicitação como Rejeitado com o motivo
  UPDATE public.solicitacoes_alteracao
  SET
    status = 'Rejeitado',
    motivo_rejeicao = p_motivo,
    analisado_por = p_admin_info,
    analisado_em = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_solicitacao_id;

  -- 2. Limpar a flag de solicitação pendente no cadastro oficial mantendo os dados originais
  IF v_solicitacao.tipo_usuario = 'passageiro' THEN
    UPDATE public.passageiros
    SET solicitacao_pendente = false
    WHERE id = v_solicitacao.usuario_id;
  ELSIF v_solicitacao.tipo_usuario = 'motorista' THEN
    UPDATE public.motoristas
    SET solicitacao_pendente = false
    WHERE id = v_solicitacao.usuario_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Solicitação rejeitada com sucesso. Dados oficiais mantidos.');
END;
$$;
