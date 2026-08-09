# Assistente de IA — reforço de segurança, limites e ações estruturadas

## O que já existe (verificado)

- Já existe um assistente de IA em `/ia`, restrito ao perfil master, com a chamada à Anthropic feita **no servidor** em `src/routes/api/ia.ts` (lê `ANTHROPIC_API_KEY` do ambiente do servidor; nunca chega ao navegador).
- O segredo `ANTHROPIC_API_KEY` já está gravado no backend — não é preciso pedi-lo de novo.
- O sistema **não tem contas individuais**: o acesso é por senha partilhada com cookie assinado (consulta / edição / master). Não existe JWT de utilizador.

## Desvios necessários ao pedido (e porquê)

Três pontos não se aplicam tal e qual a este projeto; o objetivo de segurança é cumprido de outra forma:

1. **Edge Function (Deno)** → este sistema corre em TanStack Start e a lógica de servidor vive em rotas de API do próprio projeto. A rota `/api/ia` cumpre exatamente o mesmo papel: chave só no servidor.
2. **JWT do Supabase / `supabase.functions.invoke`** → substituído pela verificação do cookie master já existente. Sem sessão master → 403.
3. **CORS por origem** → desnecessário: o endpoint é same-origin e não é chamável de outro domínio.

Todo o resto do pedido é implementado como descrito.

## O que vai ser feito

### 1. Registo de uso e limite por hora
- Nova tabela `ia_uso`: perfil de quem chamou, ação, tokens de entrada, tokens de saída, data.
- Antes de cada chamada: contar registos da última hora. **Limite 30/hora**; ao exceder, 429 com "Limite de consultas de IA atingido. Tente novamente em alguns minutos."
- Depois da resposta: gravar o consumo, para o custo ficar visível e o limite poder ser calibrado com dados reais.

### 2. Validação de entrada
- Corpo aceite: `{ acao, contexto, pergunta? }`, além do modo conversa atual.
- Payload acima de 20.000 caracteres → 413.
- `acao` fora da lista → 400. Ações permitidas: `resumo_unidade`, `priorizar_pendencias`, `explicar_exigencia`, `pergunta_livre`.

### 3. Contexto de domínio
- O prompt de sistema passa a incluir o texto indicado: 19 unidades, órgãos acompanhados, regra do semáforo (até 60 dias crítico, 61–90 a vencer, acima de 90 dentro do prazo, data passada = vencido), estados de processo, resposta em pt-BR e proibição expressa de inventar número, data ou situação.

### 4. Proteção de dados (filtragem no servidor)
- Antes de montar o pedido à Anthropic, o servidor remove do contexto qualquer campo com CPF, nome de pessoa física, e-mail ou telefone. Só seguem dados institucionais: unidade, órgão, tipo e número de processo, datas e situação.
- A filtragem corre no servidor; não se confia no que o navegador enviou.

### 5. Tratamento de erro
- Nunca devolver ao cliente o corpo bruto do erro nem qualquer vestígio da chave.
- 401 da Anthropic → registado no servidor; cliente recebe erro genérico 500.
- 429 ou 529 da Anthropic → 503 "Serviço de IA temporariamente indisponível. Tente novamente."
- Timeout de 60s com `AbortController`; erro completo sempre registado no servidor.

### 6. Interface
- No ecrã `/ia`: seletor de ação (as 4 acima), campo de pergunta, estado de carregamento, resposta e **botão para copiar**.
- Mensagens visuais distintas para 403 (sem permissão), 429 (limite atingido) e 503 (indisponível).
- Modelo mantém-se `claude-sonnet-5`; `max_tokens` fica em 2000 no modo estruturado, fácil de subir para 4000 depois com o custo já medido.

## Detalhes técnicos

- Migração: cria `public.ia_uso` (`id`, `perfil`, `acao`, `tokens_entrada`, `tokens_saida`, `criado_em`), com GRANT apenas a `service_role`, RLS ativa e sem políticas para `anon`/`authenticated` — só o servidor lê e escreve.
- `src/routes/api/ia.ts`: validação de ação e tamanho, filtro de dados pessoais, contagem do limite, chamada com `AbortController`, mapeamento de erros e registo de `usage.input_tokens` / `output_tokens`.
- `src/lib/ia.server.ts` (novo): lista de ações, sanitização de contexto, contagem e registo de uso.
- `src/routes/_authenticated/ia.tsx`: seletor de ação, botão copiar e mensagens de erro por código.

## Confirmação final

No fim confirmo explicitamente: onde a chave está guardada, que não aparece em nenhum ficheiro do cliente, e qual o ficheiro que faz a chamada à API.