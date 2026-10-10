import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';

import { ArtDisc } from '@/components/Art';
import { Lede } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { SubHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  AuthProblem,
  confirmLinkCode,
  confirmSignInCode,
  sendLinkCode,
  sendSignInCode,
  sendSignUpCode,
  validEmail
} from '@/lib/auth';
import { useSession } from '@/lib/session';
import { useEntering } from '@/theme/motion';
import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

/**
 * The account, by email: nothing in Lowkei opens without one. Two steps — an
 * address, then the six-digit code sent to it. No passwords.
 *
 * ?mode=signup  a new account (from the welcome screen)
 * ?mode=signin  an existing account, on this phone
 * ?mode=keep    a space made anonymously before accounts were required:
 *               it is kept with an email, and nothing on it moves
 */

type Mode = 'signup' | 'signin' | 'keep';

const COPY: Record<Mode, { header: string; label: string; title: string; body: string; confirm: string }> = {
  signup: {
    header: 'create an account',
    label: 'your account',
    title: 'Start with your email.',
    body: 'Your account is what makes your space yours, on any phone. We’ll send a six-digit code — no password, and no emails you didn’t ask for.',
    confirm: 'create my account'
  },
  signin: {
    header: 'sign in',
    label: 'welcome back',
    title: 'Sign in with your email.',
    body: 'We’ll send a six-digit code. Your account, circle and settings come with you; what you wrote stays on the phone you wrote it on.',
    confirm: 'sign in'
  },
  keep: {
    header: 'your account',
    label: 'one more step',
    title: 'Keep your space with an email.',
    body: 'Lowkei now needs an account. Add your email and everything here stays exactly as it is — nothing moves and nothing is lost.',
    confirm: 'keep my space'
  }
};

const RESEND_SECONDS = 30;

export default function Account() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = params.mode === 'signin' ? 'signin' : params.mode === 'signup' ? 'signup' : 'keep';
  const copy = COPY[mode];
  const session = useSession();
  const { colors } = useTheme();
  const enter = useEntering();

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  // Keeping a space is required; signing up or in can go back to the welcome.
  const back = mode === 'keep' ? undefined : () => (router.canGoBack() ? router.back() : router.replace('/onboarding'));

  const sendTo = async (address: string) => {
    setBusy(true);
    setError(null);
    try {
      await (mode === 'signin' ? sendSignInCode : mode === 'signup' ? sendSignUpCode : sendLinkCode)(address);
      setSentTo(address);
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof AuthProblem ? err.message : 'That didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const address = validEmail(email);
    if (!address) {
      setError('That doesn’t look like an email address.');
      return;
    }
    sendTo(address);
  };

  const confirm = async () => {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    try {
      await (mode === 'keep' ? confirmLinkCode : confirmSignInCode)(sentTo, code.trim());
      // A new session (sign up, sign in) or a newly permanent one (keep): read it again.
      if (mode === 'keep') await session.refreshProfile().catch(() => undefined);
      else session.retry();
      router.replace('/');
    } catch (err) {
      setError(err instanceof AuthProblem ? err.message : 'That didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = [styles.field, { color: colors.ink, borderColor: colors.glassEdge, backgroundColor: colors.glass }];

  return (
    <Screen edges={['top', 'bottom']} scene="sunrise" header={<SubHeader title={copy.header} leading={back ? 'close' : undefined} onLeading={back} />}>
      <ArtDisc name="stamp" size={96} style={styles.art} />

      {!sentTo ? (
        <Animated.View key="email" entering={enter} style={styles.block}>
          <Lede label={copy.label} title={copy.title}>
            <Text tone="soft">{copy.body}</Text>
          </Lede>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={send}
            placeholder="you@example.com"
            placeholderTextColor={colors.inkSoft}
            accessibilityLabel="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="send"
            maxFontSizeMultiplier={2}
            style={field}
          />
          {error && (
            <Text variant="bodyItalic" accessibilityRole="alert">
              {error}
            </Text>
          )}
          <Button label={busy ? 'sending…' : 'send me a code'} arrow disabled={busy || !email.trim()} onPress={send} />
          {mode === 'signup' && <Button kind="link" label="I already have an account" onPress={() => router.replace('/account?mode=signin')} />}
          {mode === 'signin' && <Button kind="link" label="I’m new — create an account" onPress={() => router.replace('/account?mode=signup')} />}
        </Animated.View>
      ) : (
        <Animated.View key="code" entering={enter} style={styles.block}>
          <Lede label="check your inbox" title="Type the six digits.">
            <Text tone="soft">{`Sent to ${sentTo}. It can take a minute, and sometimes lands in spam.`}</Text>
          </Lede>
          <TextInput
            value={code}
            onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="······"
            placeholderTextColor={colors.inkSoft}
            accessibilityLabel="Six-digit code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            maxFontSizeMultiplier={2}
            style={[field, styles.code]}
          />
          {error && (
            <Text variant="bodyItalic" accessibilityRole="alert">
              {error}
            </Text>
          )}
          <Button label={busy ? 'checking…' : copy.confirm} arrow disabled={busy || code.length !== 6} onPress={confirm} />
          <Button
            kind="link"
            label={wait > 0 ? `send a new code in ${wait}s` : 'send a new code'}
            disabled={wait > 0 || busy}
            onPress={() => sendTo(sentTo)}
          />
          <Button
            kind="link"
            label="use a different email"
            onPress={() => {
              setSentTo(null);
              setCode('');
              setError(null);
            }}
          />
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'flex-end' },
  block: { gap: space.lg },
  field: {
    borderWidth: 1,
    borderRadius: radius.card,
    minHeight: hitTarget + 8,
    paddingHorizontal: space.md + 2,
    fontFamily: fonts.sans,
    fontSize: 16
  },
  code: { fontFamily: fonts.mono, fontSize: 26, letterSpacing: 10, textAlign: 'center' }
});
