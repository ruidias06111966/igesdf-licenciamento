CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'sincronizar-licencas-vencidas-diario',
  '10 3 * * *',
  $$ SELECT public.sincronizar_licencas_vencidas(); $$
);

SELECT public.sincronizar_licencas_vencidas();