
CREATE TABLE IF NOT EXISTS public.config_rotina (
  id text PRIMARY KEY,
  hora integer NOT NULL DEFAULT 0 CHECK (hora BETWEEN 0 AND 23),
  minuto integer NOT NULL DEFAULT 10 CHECK (minuto BETWEEN 0 AND 59),
  fuso text NOT NULL DEFAULT 'America/Sao_Paulo',
  ativo boolean NOT NULL DEFAULT true,
  ultima_execucao timestamptz,
  ultimo_total integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.config_rotina TO service_role;
ALTER TABLE public.config_rotina ENABLE ROW LEVEL SECURITY;

INSERT INTO public.config_rotina (id, hora, minuto, fuso, ativo)
VALUES ('sincronizacao', 0, 10, 'America/Sao_Paulo', true)
ON CONFLICT (id) DO NOTHING;

DROP FUNCTION IF EXISTS public.sincronizar_licencas_vencidas();

CREATE OR REPLACE FUNCTION public.sincronizar_licencas_vencidas(_origem text DEFAULT 'automatico')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE afetadas integer;
BEGIN
  WITH alvo AS (
    SELECT id, status, data_vencimento
    FROM public.licencas
    WHERE data_vencimento IS NOT NULL
      AND data_vencimento < current_date
      AND status IN ('vigente', 'a_vencer', 'em_analise', 'aguardando_orgao')
  ), upd AS (
    UPDATE public.licencas l
    SET status = 'vencida'
    FROM alvo a
    WHERE l.id = a.id
    RETURNING l.id
  )
  INSERT INTO public.atividade_log (entidade, entidade_id, acao, perfil, alteracoes, detalhes)
  SELECT 'licencas', a.id, 'sincronizar',
         CASE WHEN _origem = 'manual' THEN 'sistema_manual' ELSE 'sistema' END,
         jsonb_build_array(jsonb_build_object('campo', 'status', 'antes', a.status, 'depois', 'vencida')),
         jsonb_build_object('origem', _origem, 'data_vencimento', a.data_vencimento)
  FROM alvo a;
  GET DIAGNOSTICS afetadas = ROW_COUNT;

  UPDATE public.config_rotina
  SET ultima_execucao = now(), ultimo_total = afetadas
  WHERE id = 'sincronizacao';

  RETURN afetadas;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agendar_sincronizacao()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE c public.config_rotina%ROWTYPE; alvo timestamptz; expr text; j record;
BEGIN
  SELECT * INTO c FROM public.config_rotina WHERE id = 'sincronizacao';
  IF NOT FOUND THEN RETURN 'sem configuração'; END IF;

  FOR j IN SELECT jobname FROM cron.job
           WHERE jobname IN ('sincronizar-licencas-vencidas-diario', 'sincronizar-licencas-vencidas')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;

  IF NOT c.ativo THEN RETURN 'desativado'; END IF;

  alvo := (current_date::text || ' ' || lpad(c.hora::text, 2, '0') || ':' || lpad(c.minuto::text, 2, '0'))::timestamp AT TIME ZONE c.fuso;
  expr := extract(minute FROM alvo AT TIME ZONE 'UTC')::int::text || ' '
       || extract(hour FROM alvo AT TIME ZONE 'UTC')::int::text || ' * * *';

  PERFORM cron.schedule(
    'sincronizar-licencas-vencidas-diario',
    expr,
    'SELECT public.sincronizar_licencas_vencidas(''automatico'');'
  );
  RETURN expr;
END;
$function$;

SELECT public.agendar_sincronizacao();
