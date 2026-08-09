# Como aplicar este trabalho

Dois ficheiros, para dois casos diferentes. **Na dúvida, use o `.patch`.**

---

## Caso 1 — Já tem o projeto no Lovable (o mais provável)

Use `igesdf-so-as-correcoes.patch`. São os 2 commits que faltam sobre o que já
está lá:

1. Validação: arquivar processos em vez de apagar, erro silenciado na criação
   de processo, 32 erros de lint dos ficheiros novos.
2. IA ligada aos dados do sistema + matriz de compliance + 12 testes.

```sh
cd <pasta-do-projeto>
git checkout -b claude/lovable-system-professional-7ox3n8
git am < igesdf-so-as-correcoes.patch
git push -u origin claude/lovable-system-professional-7ox3n8
```

Se `git am` reclamar que já tem alguma dessas alterações:

```sh
git am --skip     # salta o commit já aplicado
git am --abort    # desiste e volta ao estado anterior
```

---

## Caso 2 — Quer o histórico completo

Use `igesdf-historico-completo.bundle`. É auto-suficiente: traz o `main` de base
e os 6 commits. Testado por clone.

Para clonar do zero:

```sh
git clone --branch claude/lovable-system-professional-7ox3n8 \
  igesdf-historico-completo.bundle igesdf-licenciamento
```

Ou para trazer para um repositório existente:

```sh
git fetch igesdf-historico-completo.bundle \
  claude/lovable-system-professional-7ox3n8:claude/lovable-system-professional-7ox3n8
git checkout claude/lovable-system-professional-7ox3n8
```

Os 6 commits, do mais antigo ao mais recente:

| Commit | O quê |
| --- | --- |
| `8ff6568` | Reformulação: responsividade, estados de erro, pt-BR, Toaster que nunca fora montado, view do painel |
| `6d2b760` | Fim do descasamento de hidratação nas rotas protegidas |
| `0c4afeb` | Entrada por senha única e informação consistente entre painéis |
| `729aed2` | Estado do Lovable: processos SEI, IA, perfis, MCP (base, não é meu trabalho) |
| `4e3bb45` | Validação: arquivamento de processos, erro silenciado, lint |
| `87a4e57` | IA ligada aos dados + matriz de compliance + testes |

---

## Antes de publicar

Defina estas variáveis de ambiente **no painel do Lovable**, nunca no ficheiro
`.env` (que está versionado no Git e seria publicado com o código):

| Variável | Para quê |
| --- | --- |
| `ACESSO_SENHA` | Senha de edição |
| `ACESSO_SENHA_LEITURA` | Senha de consulta (opcional) |
| `ACESSO_SENHA_MASTER` | Senha master, com acesso à IA |
| `SUPABASE_SERVICE_ROLE_KEY` | Sem ela nenhuma página carrega |
| `ANTHROPIC_API_KEY` | Só para o assistente de IA |

Opcionais, para os alertas de vencimento por e-mail:
`ALERTAS_CRON_SECRET`, `ALERTAS_EMAIL_DESTINATARIO`, `LOVABLE_API_KEY`.

Verificações locais:

```sh
npm install
npx tsc --noEmit   # tipos
npm run lint       # formatação e regras
npm test           # 12 testes da matriz
npm run build
```

Ver `OPERACAO.md` no repositório para o resto.
