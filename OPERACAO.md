# Como pôr o sistema a funcionar

## 1. Variáveis de ambiente obrigatórias

Estas duas **não ficam no ficheiro `.env`** (que está versionado no Git e seria
publicado com o código). Defina-as como variáveis/segredos de ambiente do
projeto, no painel do Lovable Cloud:

| Variável                    | Para quê                                                        |
| --------------------------- | --------------------------------------------------------------- |
| `ACESSO_SENHA`              | Senha única de entrada da equipe. Sem ela ninguém entra.        |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave com que o servidor lê e grava os dados. Sem ela nenhuma página carrega. |

Se faltar alguma, o sistema não quebra em silêncio: o ecrã de entrada avisa que
`ACESSO_SENHA` não está definida, e as páginas internas mostram um aviso a
apontar `SUPABASE_SERVICE_ROLE_KEY`.

Opcionais, só para os e-mails de alerta de vencimento:
`ALERTAS_CRON_SECRET`, `ALERTAS_EMAIL_DESTINATARIO`, `LOVABLE_API_KEY`.

## 2. Aplicar a migração pendente

Falta aplicar `supabase/migrations/20260730120000_dashboard_view_somente_unidades_ativas.sql`.
Ela corrige a view do painel (que contava licenças de unidades já desativadas) e
impede itens de checklist duplicados.

O Lovable aplica as migrações da pasta `supabase/migrations/` ao sincronizar o
branch. Para aplicar à mão, cole o conteúdo do ficheiro no **SQL Editor** do
projeto Supabase (`mbpoevhioiywpyrnffez`) e execute. É segura de repetir: usa
`CREATE OR REPLACE`, `IF NOT EXISTS` e desduplica antes de criar o índice único.

## 3. Publicar

O projeto está ligado ao Lovable: os commits enviados para o branch sincronizam
e ficam disponíveis no editor, de onde se publica. A aplicação fica em
https://igesdf-licenciamento.lovable.app

## Rodar na sua máquina

Precisa de Node.js 20+.

```sh
npm install

# senha só para o ambiente local; *.local está fora do Git
printf 'ACESSO_SENHA="a-sua-senha"\n'                >  .env.local
printf 'SUPABASE_SERVICE_ROLE_KEY="a-chave"\n'       >> .env.local

npm run dev
```

Verificações antes de publicar:

```sh
npx tsc --noEmit    # tipos
npm run lint        # formatação e regras
npm run build       # build de produção
```

## Como o acesso funciona

Não há cadastro nem contas individuais. Pede-se a senha única uma vez; o
servidor confere-a e emite um cookie assinado, `HttpOnly`, válido 30 dias.

O acesso aos dados é feito **sempre** pelo servidor, com a service role. As
políticas RLS continuam fechadas ao papel `anon`, portanto a chave publicável
que viaja no navegador não consegue ler nem escrever nada diretamente na API do
Supabase. É isso que faz a senha valer alguma coisa: sem essa separação,
qualquer pessoa poderia falar direto com o banco e ignorar a senha.

Consequências práticas:

- **Trocar `ACESSO_SENHA` desliga todas as sessões abertas na hora.** A senha é
  a chave que assina os cookies. Útil quando alguém sai da equipe.
- Os anexos ficam num bucket privado; o download é feito por link temporário
  gerado pelo sistema.
- Após 8 tentativas erradas, a origem fica bloqueada 15 minutos.

### Sobre o comprimento da senha

Uma senha de 6 dígitos numéricos tem um milhão de combinações. O limite de
tentativas eleva bastante o custo de a adivinhar, mas ele é contado em memória:
num ambiente com várias instâncias do servidor, cada uma conta em separado.
Numa senha com letras e mais caracteres esta ressalva deixa de importar —
recomendo trocar quando for conveniente. Basta alterar `ACESSO_SENHA`.
