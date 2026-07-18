/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Qualixa verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><Text style={brandText}>QUALIXA</Text></Section>
        <Heading style={h1}>Confirm it's you</Heading>
        <Text style={text}>Use this code to confirm your identity on Qualixa:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code expires shortly. If you didn't request it, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { marginBottom: '28px' }
const brandText = { fontSize: '13px', fontWeight: 700 as const, letterSpacing: '0.24em', color: '#06b6d4', margin: 0 }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0b1220', margin: '0 0 16px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 18px' }
const codeStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '28px',
  fontWeight: 700 as const,
  letterSpacing: '0.3em',
  color: '#0891b2',
  background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.08))',
  border: '1px solid rgba(6,182,212,0.25)',
  borderRadius: '10px',
  padding: '16px 20px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0', lineHeight: '1.5' }
