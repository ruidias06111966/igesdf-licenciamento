-- Empresas: o primeiro passo para o sistema servir mais do que um cliente.
--
-- Esta migração é só aditiva. Cria a tabela, acrescenta uma coluna opcional a
-- `unidades` e preenche-a. Não altera nem apaga nenhum dado existente, e pode
-- correr duas vezes sem estragar nada.
--
-- ATENÇÃO: depois desta migração o sistema continua a mostrar tudo a toda a
-- gente. O isolamento entre empresas — impedir que uma veja os dados da outra —
-- é trabalho da etapa seguinte. Esta só põe a fundação e o logótipo no sítio.

-- ---------------------------------------------------------------------------
-- 1. A tabela
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sigla curta, a que aparece na interface (ex.: IGESDF).
  sigla text NOT NULL,
  -- Nome por extenso, o que sai nos documentos oficiais.
  nome text NOT NULL,
  -- Raiz do CNPJ (8 primeiros dígitos), partilhada pelas unidades da empresa.
  cnpj_raiz text,
  -- Caminho do logótipo no bucket `empresa-logos`; NULL enquanto não houver.
  logo_path text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.empresas IS
  'Empresas clientes servidas por esta instalação. Cada unidade pertence a uma.';

-- Duas empresas ativas não podem partilhar a sigla: é por ela que as pessoas as
-- distinguem na interface. Empresas desativadas ficam de fora, para a sigla
-- poder ser reaproveitada depois de uma sair.
CREATE UNIQUE INDEX IF NOT EXISTS empresas_sigla_ativa_idx
  ON public.empresas (lower(sigla))
  WHERE ativa;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Sem políticas: `anon` e `authenticated` não leem nem escrevem nada
-- diretamente. Tudo passa pelas funções de servidor, que conferem o perfil
-- antes de tocar nos dados — como nas restantes tabelas deste sistema.

-- ---------------------------------------------------------------------------
-- 2. A ligação às unidades
-- ---------------------------------------------------------------------------

ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas (id);

CREATE INDEX IF NOT EXISTS unidades_empresa_id_idx ON public.unidades (empresa_id);

COMMENT ON COLUMN public.unidades.empresa_id IS
  'Empresa a que a unidade pertence. É por aqui que licenças, documentos, '
  'processos e responsáveis técnicos herdam a empresa.';

-- ---------------------------------------------------------------------------
-- 3. O cliente que já cá está
-- ---------------------------------------------------------------------------

-- As unidades existentes são todas do IGESDF. Cria-se a empresa e ligam-se-lhe,
-- para nenhuma unidade ficar órfã. O `WHERE NOT EXISTS` evita criar uma segunda
-- se a migração correr outra vez.
INSERT INTO public.empresas (sigla, nome, cnpj_raiz)
SELECT 'IGESDF',
       'Instituto de Gestão Estratégica de Saúde do Distrito Federal',
       '28481233'
WHERE NOT EXISTS (
  SELECT 1 FROM public.empresas WHERE lower(sigla) = 'igesdf'
);

UPDATE public.unidades
SET empresa_id = (SELECT id FROM public.empresas WHERE lower(sigla) = 'igesdf' LIMIT 1)
WHERE empresa_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Onde ficam os logótipos
-- ---------------------------------------------------------------------------

-- Bucket público, ao contrário do `licencas-docs`, que é privado e servido por
-- link temporário. Um logótipo é imagem de marca, não documento reservado, e
-- precisa de um endereço estável: ele é embebido nos PDFs e nas folhas de
-- exportação, que são abertos noutra janela e impressos muito depois de terem
-- sido gerados — um link que expira deixava o documento sem logótipo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresa-logos', 'empresa-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública do bucket. A escrita não tem política nenhuma, portanto só a
-- service role — isto é, as funções de servidor — consegue carregar ou apagar.
DROP POLICY IF EXISTS "Logótipos são de leitura pública" ON storage.objects;
CREATE POLICY "Logótipos são de leitura pública"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'empresa-logos');

-- ---------------------------------------------------------------------------
-- 5. updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.empresas_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresas_updated_at ON public.empresas;
CREATE TRIGGER empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.empresas_touch_updated_at();
