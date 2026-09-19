/**
 * Domínio remetente dos e-mails transacionais. Apenas servidor.
 *
 * Isto NÃO acompanha automaticamente `MARCA.dominio`, de propósito. O
 * subdomínio remetente tem de estar delegado aos nameservers da Lovable e
 * verificado do lado deles; trocá-lo no código antes de a delegação existir faz
 * com que nenhum e-mail saia — confirmação de conta, recuperação de senha e
 * alertas de vencimento incluídos —, e a falha só aparece quando alguém tenta
 * criar conta.
 *
 * Por isso o valor vem de uma variável de ambiente e o valor por omissão
 * continua a ser o domínio já verificado. Depois de delegar e verificar
 * `notify.qilicenciamento.qidominios.com.br`, define-se
 * `EMAIL_SENDER_DOMAIN` no painel da Lovable e o envio passa para o domínio
 * novo sem tocar em código nem arriscar uma janela sem e-mail.
 */

/** Domínio verificado hoje — só muda quando a delegação de DNS estiver feita. */
const VERIFICADO = "notify.igesdf-licenciamento.qidominios.tech";

/** FQDN do subdomínio remetente verificado. Nunca o domínio raiz. */
export const SENDER_DOMAIN = process.env["EMAIL_SENDER_DOMAIN"]?.trim() || VERIFICADO;

/** Domínio mostrado no cabeçalho From: — cosmético. */
export const FROM_DOMAIN = process.env["EMAIL_FROM_DOMAIN"]?.trim() || SENDER_DOMAIN;
