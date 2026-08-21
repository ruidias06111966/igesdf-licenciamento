# Auditoria, modelos versionados, alertas, importação CSV e PDF para o SEI

Cinco melhorias ao IGESDF - Licenciamento, todas em cima das tabelas e módulos já existentes.

## 1. Histórico e auditoria

Cada gravação de licença passa a registar quem, quando e o que mudou.

- A tabela de registo de atividade passa a guardar, além da ação, o **antes/depois de cada campo alterado** e o **perfil** que fez a alteração (edição / master / consulta).
- Gravam-se: criação, alteração e exclusão de licenças, e a geração de cada despacho ou consolidado (unidade, competência, data).
- Novo separador **Histórico** dentro da ficha da unidade e da folha de licenças, com data/hora, perfil, campo, valor anterior e novo valor.
- Nova página **Auditoria** (perfil master) com filtros por unidade, órgão, tipo de ação e intervalo de datas, e exportação CSV/PDF.

## 2. Biblioteca de modelos: versões e organização

- Cada modelo passa a ter **versões**: ao guardar por cima cria-se uma versão nova, mantendo o histórico e permitindo repor uma versão anterior.
- Novos campos de classificação: **órgão** (VISADF, CBMDF, IBRAM, DF LEGAL, …) e **tipo de unidade** (Hospital / UPA / Administrativo), além do tipo de documento e etiquetas já existentes.
- A biblioteca ganha filtros por órgão, tipo de unidade e tipo de documento, com pesquisa por título, para chegar depressa ao modelo certo.
- Ao gerar um despacho, o sistema sugere primeiro os modelos que correspondem ao órgão e ao tipo da unidade selecionada.

## 3. Alertas e próximos vencimentos

- Novo painel **Próximos vencimentos** no dashboard: licenças a vencer em 15 / 30 / 60 / 90 dias e já vencidas, agrupadas por unidade e órgão, com semáforo e ligação direta à licença.
- Nova página **Alertas** com a mesma lista em formato de tabela filtrável e imprimível em PDF.
- Sino de notificações no cabeçalho com a contagem de licenças críticas (vencidas + a vencer em 30 dias).
- O envio diário de e-mail já existente passa a registar no histórico o que foi notificado, evitando repetições no mesmo escalão de dias.

## 4. Importação por CSV

Nova página **Importar** (perfil de edição), com três tipos de ficheiro: **licenças**, **processos SEI** e **atividades/CNAEs**.

- Descarregar modelo CSV de cada tipo, já com cabeçalhos e um exemplo.
- Carregar o ficheiro, ver a **pré-visualização** com o que vai ser criado, atualizado e ignorado, linha a linha, com os erros assinalados.
- Correspondência por chave natural (unidade + órgão + CNAE, ou número do processo), para atualizar em vez de duplicar.
- Confirmação explícita antes de gravar; tudo o que for importado fica registado na auditoria e pode ser revertido a partir do histórico.

## 5. Exportação PDF pronta para o SEI

- Despachos, consolidado, modelos e relatórios ganham **Exportar PDF** que gera o ficheiro diretamente (A4, margens do SEI, cabeçalho e rodapé com identificação da unidade, data e número do processo), sem passar pela caixa de impressão do navegador.
- Nome do ficheiro normalizado: `despacho-<unidade>-<data>.pdf`, pronto a anexar no SEI.
- Mantêm-se as opções atuais de copiar HTML formatado e texto simples.

## Detalhes técnicos

- Migração: colunas de auditoria (`perfil`, `alteracoes` jsonb) em `atividade_log`; tabela `ia_modelo_versoes`; colunas `orgao` e `tipo_unidade` em `ia_modelos`. Todas com GRANT conforme o padrão do projeto.
- Registo de auditoria centralizado num helper de servidor chamado por `upsertLicenca`, `deleteLicenca`, importação CSV e geração de despachos — comparação campo a campo antes da escrita.
- Importação CSV: análise no cliente (mesmo separador `;` e BOM já usados na exportação), validação com Zod e gravação em lote por server function sob `requireEdicao`.
- PDF gerado no cliente com `jspdf` + `html2canvas` a partir da folha A4 já existente, mantendo as regras de impressão sem cortes.
- Novas rotas `/auditoria`, `/alertas` e `/importar`, com `head()` próprio e entradas de menu conforme o perfil.

## Fora deste âmbito

- Assinatura digital dos PDFs.
- Envio automático para o SEI (continua por anexação manual).
