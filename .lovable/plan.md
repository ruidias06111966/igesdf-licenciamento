# Entrada por conta própria (e-mail + senha) com autorização pelo Master

Substituir as três senhas partilhadas (edição / consulta / master) por contas individuais: cada pessoa cadastra-se com o seu e-mail, escolhe a senha, confirma o e-mail e fica **pendente** até o Master lhe atribuir um perfil.

## Como passa a funcionar

1. **Cadastro**: a pessoa abre `/auth`, escolhe "Criar conta", indica nome, e-mail e senha (mínimo 8 caracteres).
2. **Confirmação por e-mail**: recebe um e-mail com o link de confirmação, enviado pelo domínio já configurado do sistema (`notify.igesdf-licenciamento…`), com a identidade visual do IGESDF.
3. **Pendente**: depois de confirmar e entrar, vê apenas um ecrã "Aguardando autorização" — nenhum dado do sistema é lido ou escrito enquanto não tiver perfil.
4. **Autorização pelo Master**: em Configurações → **Utilizadores**, o Master vê a lista (nome, e-mail, data de cadastro, estado) e atribui um dos perfis:
   - **Consulta** — ver e imprimir relatórios;
   - **Edição** — inserir, alterar e excluir;
   - **Master** — tudo, incluindo IA, despachos, consolidado e a própria gestão de utilizadores.
   Pode também alterar o perfil mais tarde, **suspender** (revoga o acesso mantendo o histórico) ou reativar.
5. **Sessão**: passa a ser a sessão de conta (com "esqueci a senha" por e-mail), em vez do cookie de senha partilhada.

O primeiro Master é a sua conta: ao cadastrar-se com o seu e-mail, é promovida automaticamente a Master. Depois disso, ninguém mais recebe perfil sem a sua autorização.

## O que muda na segurança

Os três níveis já existentes no servidor (`consulta`, `edição`, `master`) mantêm-se e continuam a ser verificados **no servidor** em cada operação — muda apenas a origem da identidade: em vez de "quem sabe a senha X", passa a ser "esta conta tem este perfil". A trilha de auditoria passa a registar **o e-mail de quem fez cada alteração**, em vez de apenas "edicao"/"master".

## Detalhes técnicos

- **Auth**: Supabase Auth com e-mail/senha e confirmação obrigatória (sem auto-confirm, sem cadastro anónimo). Templates de e-mail de autenticação com a marca do sistema.
- **Tabelas**: nova `profiles` (id, e-mail, nome, criado_em) alimentada por trigger em novos registos; papéis na `user_roles` já existente, com estados `master` / `edicao` / `leitura` (valores adicionados ao enum `app_role`) e coluna de suspensão. RLS: cada pessoa lê o seu próprio perfil; a gestão faz-se por funções de servidor com verificação de Master.
- **Autorização**: `requireAcesso` / `requireEdicao` / `requireMaster` passam a validar o token da sessão e o papel na base, mantendo a mesma assinatura — as ~12 famílias de funções de servidor que já os usam não precisam de alterações.
- **Cliente**: `src/start.ts` volta a anexar o token da sessão às chamadas; o guarda `_authenticated` passa a exigir sessão + perfil atribuído; `usePodeEditar` / `useEhMaster` passam a ler o perfil da conta.
- **Transição**: as senhas partilhadas deixam de funcionar assim que o novo acesso entrar; as variáveis `ACESSO_SENHA*` deixam de ser usadas.

## O que preciso de si

O **e-mail** que será o Master (para eu configurar a promoção automática dessa conta).
