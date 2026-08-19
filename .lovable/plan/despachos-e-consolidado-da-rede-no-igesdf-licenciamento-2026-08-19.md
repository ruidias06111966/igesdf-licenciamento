# Despachos e Consolidado da Rede no IGESDF - Licenciamento

Integrar os dois geradores HTML feitos no Claude como módulos nativos do sistema, alimentados pelos dados já existentes (unidades, CNAEs, licenças por órgão, validades, processos SEI).

Sim, a integração é possível: os campos que os HTML pedem à mão já existem na base — unidade, CNPJ, endereço, CNAEs, órgão licenciador, situação/estado da licença, data de validade e processo SEI.

## O que passa a existir

Dois menus novos na barra lateral, visíveis apenas ao perfil **Master**:

1. **Despachos** — gerador de despacho por unidade (equivalente ao `gerador-despacho-licenciamento-nucon`).
2. **Consolidado da Rede** — despacho mensal/trimestral de toda a rede (equivalente ao `consolidado-rede-licenciamento-nucon`).

### Despachos (por unidade)

- Escolhe-se a unidade e o sistema **pré-preenche tudo**: CNPJ, endereço, CNAEs com descrição, e a régua de situação por órgão (classificação licenciada/dispensada/não licenciada, situação, validade) a partir das licenças gravadas.
- Campos do certificado que não estão na base (emissão, código de validação, áreas, inauguração, viabilidade de localização) ficam editáveis no formulário, com o último valor guardado por unidade.
- Mantêm-se as funcionalidades do HTML: parágrafos condicionais, lista de providências, dupla assinatura (pré-preenchida com Rui José Lopes Dias / Paulo Ricardo Oliveira Lima), painel de conferência e pré-visualização em folha A4.
- Botões: **Copiar para o SEI** (com formatação), copiar texto simples, imprimir/PDF e **Guardar na Biblioteca de Modelos IA**.
- **Gravar de volta**: ao ajustar a situação de um órgão/CNAE dentro do despacho, um botão "Aplicar alterações às licenças" mostra o que vai mudar e grava na base após confirmação.

### Consolidado da Rede

- Em vez de carregar ficheiros JSON, lê diretamente todas as unidades e licenças do sistema.
- Gera as duas variantes do HTML: **mensal** (alterações, vencimentos, indeferimentos, protocolos pendentes, fecho) e **trimestral** (panorama, situação por órgão, tempo de espera por faixas, pendências mais antigas, considerações).
- Tempo de permanência calculado a partir da última alteração das licenças (`updated_at`), com a mesma ressalva do HTML quando não há histórico suficiente.
- Filtros por competência, tipo de unidade (Hospital / UPA / Administrativo) e órgão; secções ligáveis/desligáveis como no original.
- Painel de **Conferência** com os mesmos alertas: licenças vencidas, indeferidas, retrocessos e unidades sem certificado atualizado.
- Exportação: copiar para o SEI, imprimir/PDF A4 e exportar o quadro em CSV; guardar na Biblioteca de Modelos IA.

## Detalhes técnicos

- Rotas `src/routes/_authenticated/despachos.tsx` e `src/routes/_authenticated/consolidado.tsx`, com `head()` próprio e entradas de navegação restritas por `useEhMaster` em `src/components/app-shell.tsx`.
- Lógica de texto portada dos HTML para módulos puros em `src/lib/despacho/` (montagem de parágrafos, agrupamento por classe/situação, derivação do estado do órgão, conferência), partilhada pelos dois ecrãs.
- Leitura via novas server functions em `src/lib/despachos.functions.ts` (`dadosDespachoUnidade`, `dadosConsolidado`), protegidas para master, reaproveitando as consultas de unidades/licenças existentes.
- Escrita de volta usa `upsertLicenca` já existente, em lote, sob `requireEdicao`.
- Guardar despacho usa `upsertModelo` de `src/lib/modelos.functions.ts` (tipo `despacho`), ligando `unidade_id` e `processo_id` quando aplicável — sem alterações de esquema.
- Campos extra do certificado (áreas, código de validação, emissão) guardados em campo estruturado da unidade; se exigir coluna nova, migração com GRANT conforme o padrão do projeto.
- Estilo com componentes shadcn e tokens do sistema; a "folha" do despacho mantém serifa e layout A4, respeitando as regras de impressão sem cortes já em vigor.

## Fora deste âmbito

- Envio automático do despacho para o SEI (continua por cópia manual).
- Geração de texto por IA — o despacho é determinístico a partir dos dados; o Assistente IA pode ser usado à parte para refinar redação.