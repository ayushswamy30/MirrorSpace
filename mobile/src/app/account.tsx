import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';

import { Art } from '@/components/Art';
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
  validEmail
} from '@/lib/auth';
import { useSession } from '@/lib/session';
import { useEntering } from '@/theme/motion';
import { hitTarget, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

/**
 * Keep your space with an email — or sign in to it on another phone. Two
 * steps: an address, then the six-digit code sent to it. Always optional:
 * "not now" goes straight into the app.
 *
 * ?mode=signin  signing in to an existing account
 * ?next=welcome arriving from the end of onboarding
 */
export default function Account() {
  const { mode, next } = useLocalSearchParams<{ mode?: string; next?: string }>();
  const signIn = mode === 'signin';
  const fromOnboarding = next === 'welcome';
  const session = useSession();
  const { colors } = useTheme();
  const enter = useEntering();

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = () => (fromOnboarding || signIn ? router.replace('/') : router.back());

  const send = async () => {
    const address = validEmail(email);
    if (!address) {
      setError('That doesn’t look like an email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await (signIn ? sendSignInCode : sendLinkCode)(address);
      setSentTo(address);
    } catch (err) {
      setError(err instanceof AuthProblem ? err.message : 'That didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    try {
      await (signIn ? confirmSignInCode : confirmLinkCode)(sentTo, code.trim());
      // A new session (sign in) or a newly permanent one (link): read it again.
      if (signIn) session.retry();
      else await session.refreshProfile().catch(() => undefined);
      leave();
    } catch (err) {
      setError(err instanceof AuthProblem ? err.message : 'That didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = [styles.field, { color: colors.ink, borderColor: colors.hairline }];

  return (
    <Screen
      edges={['top', 'bottom']}
      header={<SubHeader title={signIn ? 'sign in' : 'your account'} leading="close" onLeading={leave} />}
    >
      <Art name="stamp" size={96} style={styles.art} />

      {!sentTo ? (
        <Animated.View key="email" entering={enter} style={styles.block}>
          <Lede
            label={signIn ? 'welcome back' : 'keep your space'}
            title={signIn ? 'Sign in with your email.' : 'Keep your space with an email.'}
          >
            <Text tone="soft">
              {signIn
                ? 'We’ll send a six-digit code. What you wrote on your old phone stays on that phone; your account, circle and settings come with you.'
                : 'So you can sign in again on a new phone. We’ll send a six-digit code — no password to remember, and no emails you didn’t ask for.'}
            </Text>
          </Lede>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.inkSoft}
            accessibilityLabel="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            maxFontSizeMultiplier={2}
            style={field}
          />
          {error && (
            <Text variant="bodyItalic" accessibilityRole="alert">
              {error}
            </Text>
          )}
          <Button label={busy ? 'sending…' : 'send me a code'} arrow disabled={busy || !email.trim()} onPress={send} />
          <Button kind="link" label={signIn ? 'not now' : 'not now — maybe later'} onPress={leave} />
          {!signIn && (
            <Text variant="caption" tone="soft">
              Phone numbers aren’t offered yet: text messages cost money, and MirrorSpace runs on free services.
            </Text>
          )}
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
          <Button label={busy ? 'checking…' : signIn ? 'sign in' : 'keep my space'} arrow disabled={busy || code.length !== 6} onPress={confirm} />
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
    minHeight: hitTarget + 4,
    paddingHorizontal: space.md,
    fontFamily: fonts.sans,
    fontSize: 16
  },
  code: { fontFamily: fonts.mono, fontSize: 26, letterSpacing: 10, textAlign: 'center' }
});
