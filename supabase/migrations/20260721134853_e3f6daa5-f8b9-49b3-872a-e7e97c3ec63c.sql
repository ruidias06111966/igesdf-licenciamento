-- data de validade do documento (validade do certificado/anexo em si)
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS data_validade date;

-- helper: marcar uma versão específica como vigente (arquiva as outras do mesmo grupo)
CREATE OR REPLACE FUNCTION public.set_versao_vigente(_doc_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  raiz uuid;
BEGIN
  SELECT COALESCE(documento_pai_id, id) INTO raiz FROM public.documentos WHERE id = _doc_id;
  IF raiz IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;
  UPDATE public.documentos SET ativo = false
    WHERE (id = raiz OR documento_pai_id = raiz) AND id <> _doc_id;
  UPDATE public.documentos SET ativo = true WHERE id = _doc_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_versao_vigente(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.set_versao_vigente(uuid) TO authenticated;