import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarUnidades from "./tools/listar-unidades";
import detalheUnidade from "./tools/detalhe-unidade";
import listarLicencas from "./tools/listar-licencas";
import licencasAVencer from "./tools/licencas-a-vencer";
import listarProcessosSei from "./tools/listar-processos-sei";
import listarNormativas from "./tools/listar-normativas";

// O emissor OAuth tem de ser o host direto do Supabase (o URL publicado é um
// proxy e seria rejeitado na verificação RFC 8414).
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "igesdf-licenciamento",
  title: "IGESDF - Licenciamento",
  version: "0.1.0",
  instructions:
    "Ferramentas de consulta do sistema de licenciamento do IGESDF: unidades (hospitais, UPAs e administrativos), licenças e alvarás por órgão licenciador (VISADF, DF LEGAL, CBMDF, IBRAM, SUSDEC, PCDF, SEAGRI, SEEDF), prazos de vencimento, processos SEI com checklists e normativas aplicáveis. Todas as ferramentas são só de leitura e exigem uma conta autorizada.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listarUnidades,
    detalheUnidade,
    listarLicencas,
    licencasAVencer,
    listarProcessosSei,
    listarNormativas,
  ],
});
