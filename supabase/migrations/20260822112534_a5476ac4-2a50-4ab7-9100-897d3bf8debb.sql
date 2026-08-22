
REVOKE ALL ON FUNCTION public.sincronizar_licencas_vencidas(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agendar_sincronizacao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_licencas_vencidas(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.agendar_sincronizacao() TO service_role;
