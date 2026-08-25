import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface EmailChangeEmailProps {
  siteName: string;
  // oldEmail é o endereço atual (HookData.OldEmail). No envio para o NOVO
  // destinatário, `email` é igual ao novo endereço, por isso mostramos
  // oldEmail para se ler "de ANTIGO para NOVO".
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração de e-mail no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={marca}>{siteName}</Text>
        <Heading style={h1}>Confirme a alteração de e-mail</Heading>
        <Text style={text}>
          Foi pedida a alteração do e-mail da sua conta no {siteName} de{" "}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{" "}
          para{" "}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          . Confirme clicando no botão abaixo.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar alteração
        </Button>
        <Text style={footer}>
          IGESDF - Licenciamento · Instituto de Gestão Estratégica de Saúde do Distrito Federal.
          Mensagem automática — não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "28px 25px", maxWidth: "600px" };
const marca = {
  fontSize: "13px",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#0f766e",
  fontWeight: "bold" as const,
  margin: "0 0 4px",
};
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#0b2b2b",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#44525a",
  lineHeight: "1.6",
  margin: "0 0 22px",
};
const link = { color: "#0f766e", textDecoration: "underline" };
const button = {
  backgroundColor: "#0f766e",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  borderRadius: "8px",
  padding: "12px 22px",
  textDecoration: "none",
  display: "inline-block",
};
const codeStyle = {
  fontSize: "30px",
  letterSpacing: "6px",
  fontWeight: "bold" as const,
  color: "#0b2b2b",
  margin: "0 0 22px",
};
const footer = {
  fontSize: "12px",
  color: "#8a969c",
  lineHeight: "1.6",
  margin: "30px 0 0",
  borderTop: "1px solid #e5eaec",
  paddingTop: "14px",
};
