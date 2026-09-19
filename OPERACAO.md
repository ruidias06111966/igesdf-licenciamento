# QiLicenciamentos — operação

Sistema de controlo de licenciamentos e alvarás, da suíte **QiDominios**.
Cliente: **IGESDF** — Instituto de Gestão Estratégica de Saúde do Distrito
Federal.

Endereço de produção pretendido: <https://qilicenciamento.qidominios.com.br>

## 1. Variáveis de ambiente

Nenhuma destas fica no ficheiro `.env`: esse ficheiro **está versionado no Git**
e seria publicado junto com o código. Defina-as como variáveis/segredos de
ambiente do projeto, no painel do Lovable Cloud.

### Obrigatórias

| Variável                    | Para quê                                                                      |
| --------------------------- | ----------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave com que o servidor lê e grava os dados. Sem ela nenhuma página carrega.  |
| `SUPABASE_URL`              | Endereço do projeto Supabase.                                                  |
| `SUPABASE_PUBLISHABLE_KEY`  | Chave usada para validar o token de sessão de quem entra.                      |

### Opcionais

| Variável                     | Para quê                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `ACESSO_MASTER_EMAIL`        | Conta sempre master. Por omissão `qidominio@gmail.com`.                          |
| `EMAIL_SENDER_DOMAIN`        | Subdomínio remetente dos e-mails. Ver a secção 3 — **não mudar sem DNS feito**. |
| `EMAIL_FROM_DOMAIN`          | Domínio mostrado no cabeçalho `From:`. Cosmético.                                |
| `ALERTAS_CRON_SECRET`        | Protege o endpoint que dispara os alertas de vencimento.                         |
| `ALERTAS_EMAIL_DESTINATARIO` | Para onde vão esses alertas.                                                     |
| `RESEND_API_KEY`             | Envia os e-mails pela Resend. Sem ela, saem pela Lovable.                        |
| `ANTHROPIC_API_KEY`          | Põe o assistente a falar direto com a Anthropic. Sem ela, fala pela Lovable.     |
| `LOVABLE_API_KEY`            | Caminho antigo dos e-mails e do assistente, enquanto os dois acima não existirem.|

Os alertas de vencimento só funcionam com um serviço de e-mail configurado **e**
com um agendamento a chamar o endpoint. Sem isso, o sistema continua a mostrar os
vencimentos no ecrã, mas não avisa ninguém por e-mail.

### Sair da Lovable, aos poucos

Os e-mails e o assistente têm dois caminhos, e a escolha é a variável de
ambiente: definida a chave nova, passam a usá-la; sem ela, continuam pela
Lovable. Assim a troca não deixa o sistema sem enviar e-mails nem sem
assistente entre a alteração do código e a chegada da chave.

O que ainda depende da Lovable e não tem alternativa no código:

- **Os e-mails de autenticação** (confirmar conta, repor senha) passam pelo
  `lovable/email/auth/webhook`, que está registado nas definições de
  autenticação do Supabase. Trocá-lo exige mexer lá, não só aqui.
- **O alojamento.** O build já produz um pacote para Cloudflare Workers, o que
  torna a mudança viável, mas o endereço continua a ser servido pela Lovable.
- **A base de dados**, que está numa organização da Lovable e não na conta
  QiDominios. É o ponto que decide o resto.

## 2. Nome e domínio

O nome do produto e o endereço estão num sítio só: `src/lib/marca.ts`. Mudar o
nome ou o domínio é mudar esse ficheiro — títulos das páginas, `canonical`,
`og:url`, sitemap, barra lateral, ecrã de entrada e rodapé dos e-mails
acompanham sozinhos.

`MARCA` é o produto (QiLicenciamentos) e `CLIENTE` é quem o usa (IGESDF). Os
dois estão separados de propósito: os documentos oficiais exportados continuam a
sair com o timbre do IGESDF/NUCON, porque isso é um facto sobre o documento e
não uma questão de marca.

## 3. Domínio dos e-mails — ler antes de mexer

O subdomínio remetente tem de estar **delegado aos nameservers da Lovable e
verificado do lado deles**. Por isso ele *não* acompanha automaticamente o
domínio novo: continua em `notify.igesdf-licenciamento.qidominios.tech`, que é o
que está verificado hoje.

Trocá-lo no código antes de a delegação existir faz com que **nenhum e-mail
saia** — confirmação de conta, recuperação de senha e alertas incluídos — e a
falha só aparece quando alguém tenta criar conta.

A ordem correta é:

1. Criar `notify.qilicenciamento.qidominios.com.br` e delegá-lo à Lovable.
2. Esperar que a Lovable confirme a verificação.
3. Só então definir `EMAIL_SENDER_DOMAIN=notify.qilicenciamento.qidominios.com.br`.

Nada disto exige alterar código.

## 4. Publicar

O projeto está ligado ao Lovable: os commits enviados para o branch sincronizam
e ficam disponíveis no editor, de onde se publica.

Para o endereço `qilicenciamento.qidominios.com.br` responder, é preciso
apontá-lo ao projeto nas definições de domínio da Lovable. Enquanto isso não
estiver feito, o sistema funciona na mesma no endereço `.lovable.app`; o que
muda é que os `canonical`/`og:url` já apontam para o endereço novo.

## 5. Rodar na sua máquina

Precisa de Node.js 20+.

```sh
npm install

# segredos só do ambiente local; *.local está fora do Git
printf 'SUPABASE_SERVICE_ROLE_KEY="a-chave"\n' > .env.local

npm run dev
```

Verificações antes de publicar:

```sh
npx tsc --noEmit                      # tipos
npx eslint src                        # regras e formatação
npx playwright test tests/matriz.spec.ts   # testes
npm run build                         # build de produção
```

## 6. Como o acesso funciona

Cada pessoa cria a sua conta (e-mail + senha), confirma o e-mail e fica
**pendente** até o utilizador master lhe atribuir um perfil:

| Perfil    | Pode                                                      |
| --------- | --------------------------------------------------------- |
| `leitura` | Consultar e imprimir.                                      |
| `edicao`  | O anterior, mais criar, alterar e excluir registos.        |
| `master`  | Tudo, mais autorizar contas, despachos e o assistente IA.  |

A gestão de contas está em **Configurações → Acesso**.

O acesso aos dados é feito **sempre** pelo servidor, com a service role. As
políticas RLS continuam fechadas aos papéis `anon` e `authenticated`, portanto a
chave publicável que viaja no navegador não consegue ler nem escrever nada
diretamente na API do Supabase. Tudo passa pelas funções de servidor, onde o
perfil é conferido antes de qualquer leitura ou escrita.

Os anexos ficam num bucket privado; o download é feito por link temporário
gerado pelo sistema.

## 7. Migrações

O Lovable aplica as migrações da pasta `supabase/migrations/` ao sincronizar o
branch. Para aplicar à mão, cole o conteúdo do ficheiro no **SQL Editor** do
projeto Supabase e execute.
