import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>O seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={marca}>IGESDF - Licenciamento</Text>
        <Heading style={h1}>Confirme a sua identidade</Heading>
        <Text style={text}>Use o código abaixo para confirmar a operação:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={text}>
          O código expira em poucos minutos. Se não foi você, ignore este
          e-mail.
        </Text>
        <Text style={footer}>
          IGESDF - Licenciamento · Instituto de Gestão Estratégica de Saúde do
          Distrito Federal. Mensagem automática — não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 25px', maxWidth: '600px' }
const marca = {
  fontSize: '13px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#0f766e',
  fontWeight: 'bold' as const,
  margin: '0 0 4px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0b2b2b',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#44525a',
  lineHeight: '1.6',
  margin: '0 0 22px',
}
const link = { color: '#0f766e', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0f766e',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
const codeStyle = {
  fontSize: '30px',
  letterSpacing: '6px',
  fontWeight: 'bold' as const,
  color: '#0b2b2b',
  margin: '0 0 22px',
}
const footer = {
  fontSize: '12px',
  color: '#8a969c',
  lineHeight: '1.6',
  margin: '30px 0 0',
  borderTop: '1px solid #e5eaec',
  paddingTop: '14px',
}
