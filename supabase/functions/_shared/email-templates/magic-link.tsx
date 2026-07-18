/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Qualixa sign-in link</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><Text style={brandText}>QUALIXA</Text></Section>
        <Heading style={h1}>Your sign-in link</Heading>
        <Text style={text}>
          Click the button below to sign in to Qualixa. This link expires shortly for your security.
        </Text>
        <Button style={button} href={confirmationUrl}>Sign in to Qualixa</Button>
        <Text style={footer}>Didn't request this link? You can safely ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { marginBottom: '28px' }
const brandText = { fontSize: '13px', fontWeight: 700 as const, letterSpacing: '0.24em', color: '#06b6d4', margin: 0 }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0b1220', margin: '0 0 16px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 18px' }
const button = {
  background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
  backgroundColor: '#06b6d4',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '13px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0 24px',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0', lineHeight: '1.5' }
