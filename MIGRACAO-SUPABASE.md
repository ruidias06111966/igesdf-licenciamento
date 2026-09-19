# Mudar a base de dados para a conta QiDominios

O QiLicenciamentos vive hoje num projeto Supabase criado pelo **Lovable Cloud**
(`mbpoevhioiywpyrnffez`), que está numa organização da Lovable e não na conta
QiDominios. Os dados são do IGESDF; o contentor não é nosso.

Este guião move-o para a organização **QiDominios**.

> **Antes de começar:** faça uma cópia de segurança do projeto atual. Todos os
> passos abaixo leem do projeto antigo e escrevem no novo, sem destruir nada —
> mas a cópia é o que lhe permite voltar atrás sem depender de ninguém.

## O que já está verificado

As 31 migrações em `supabase/migrations/` reconstroem a estrutura **do zero**:
a primeira cria as tabelas de raiz e a última é a do multi-cliente. Foram
conferidas e são portáveis:

- não há uma única referência ao projeto antigo;
- usam apenas `auth`, `storage` e os papéis `anon`/`authenticated`, que existem
  em qualquer projeto Supabase;
- a única extensão é o `pg_cron`, que agenda uma função local — não chama nada
  fora da base.

Ou seja: **a estrutura é trabalho resolvido.** O que dá trabalho é o conteúdo.

## Os quatro pedaços, por ordem

### 1. Estrutura — automático

Com a organização já em Pro, o projeto novo é criado e as 31 migrações são
aplicadas por ordem. No fim existe uma base QiLicenciamentos vazia, completa e
sua.

### 2. Dados — precisa da ligação ao projeto antigo

As linhas das tabelas. Precisa da *connection string* do projeto antigo, que
está no painel da Lovable (ou no do Supabase, se lhe derem acesso).

```sh
# Do projeto antigo, só o schema public e só os dados:
pg_dump --data-only --schema=public \
  --exclude-table=schema_migrations \
  "postgresql://postgres:<SENHA>@db.mbpoevhioiywpyrnffez.supabase.co:5432/postgres" \
  > dados.sql

# Para o projeto novo:
psql "postgresql://postgres:<SENHA_NOVA>@db.<REF_NOVA>.supabase.co:5432/postgres" \
  < dados.sql
```

A ordem das tabelas importa por causa das chaves estrangeiras; o `pg_dump`
resolve-a sozinho se o dump for feito de uma vez, como acima.

### 3. Anexos — a parte mais chata

O bucket `licencas-docs` guarda os certificados, licenças e documentos. São
ficheiros, não linhas: têm de ser copiados um a um, e os caminhos guardados na
coluna `storage_path` da tabela `documentos` têm de continuar a bater certo.

Copiar mantendo os mesmos caminhos é o que garante que nada parte — se os
caminhos mudarem, cada documento do sistema passa a apontar para o vazio.

O bucket `empresa-logos` (público) vai pelo mesmo caminho, e é pequeno.

### 4. Contas — decidir antes de fazer

Os utilizadores vivem em `auth.users`. Há duas hipóteses:

- **Migrar os hashes das senhas** junto com as contas: ninguém dá por nada.
- **Recriar as contas** e pedir a toda a gente que reponha a senha: mais simples
  de executar, mas obriga a avisar as pessoas.

A tabela `perfis_acesso` refere `user_id` de `auth.users`, portanto os ids têm
de ser preservados em qualquer dos casos — caso contrário os perfis ficam
órfãos e ninguém entra.

## Depois da mudança

Trocar no painel de ambiente, e só depois publicar:

| Variável | Novo valor |
| --- | --- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | endereço do projeto novo |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publicável nova |
| `SUPABASE_SERVICE_ROLE_KEY` | chave de service role nova |
| `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID` | referência do projeto novo |

E confirmar, com o sistema já a apontar ao projeto novo:

1. entrar com uma conta e ver o painel com os números certos;
2. abrir um documento antigo — prova que os caminhos do storage sobreviveram;
3. gerar uma exportação com o logótipo da empresa;
4. confirmar que o `pg_cron` agendou a rotina diária (`SELECT * FROM cron.job`).

## O que fica na Lovable mesmo depois disto

A base sai, mas não é a única amarra. Por ordem de dificuldade:

- **E-mails de autenticação** — o webhook está registado nas definições de
  autenticação do Supabase a apontar para a Lovable. Sai mexendo lá.
- **Alojamento** — o build já produz um pacote para Cloudflare Workers, portanto
  a mudança é viável; falta apontar o domínio.
- **Servidor MCP** — usa o SDK e o OAuth da Lovable.

Os e-mails e o assistente de IA já estão preparados: basta definir
`RESEND_API_KEY` e `ANTHROPIC_API_KEY` para deixarem de passar pela Lovable, sem
tocar em código. Ver o `OPERACAO.md`.
