-- 1) Corrige as licenças cuja data de vencimento já passou mas continuam com situação ativa
UPDATE public.licencas
SET status = 'vencida'
WHERE data_vencimento IS NOT NULL
  AND data_vencimento < current_date
  AND status IN ('vigente', 'a_vencer', 'em_analise', 'aguardando_orgao');

-- 2) Rotina reutilizável para manter as situações em dia
CREATE OR REPLACE FUNCTION public.sincronizar_licencas_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE afetadas integer;
BEGIN
  UPDATE public.licencas
  SET status = 'vencida'
  WHERE data_vencimento IS NOT NULL
    AND data_vencimento < current_date
    AND status IN ('vigente', 'a_vencer', 'em_analise', 'aguardando_orgao');
  GET DIAGNOSTICS afetadas = ROW_COUNT;
  RETURN afetadas;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_licencas_vencidas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_licencas_vencidas() TO service_role;

-- 3) Ao gravar uma licença, a situação acompanha a data
CREATE OR REPLACE FUNCTION public.aplicar_situacao_por_vencimento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_vencimento IS NOT NULL
     AND NEW.data_vencimento < current_date
     AND NEW.status IN ('vigente', 'a_vencer') THEN
    NEW.status := 'vencida';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS licencas_situacao_por_vencimento ON public.licencas;
CREATE TRIGGER licencas_situacao_por_vencimento
BEFORE INSERT OR UPDATE OF data_vencimento, status ON public.licencas
FOR EACH ROW EXECUTE FUNCTION public.aplicar_situacao_por_vencimento();