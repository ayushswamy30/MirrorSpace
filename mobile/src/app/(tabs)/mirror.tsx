import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Art } from '@/components/Art';
import { AppHeader } from '@/components/Header';
import { Starfield } from '@/components/Starfield';
import { Locked } from '@/components/Locked';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  addMessage,
  askMirror,
  clearConversation,
  listMessages,
  mirrorStatus,
  MirrorUnavailable,
  TOPICS,
  type TopicKey,
  type MirrorMessage,
  type MirrorStatus
} from '@/lib/mirror';
import { citations, memoryForMirror } from '@/lib/memory';
import { reflectionsPaused } from '@/lib/safety/log';
import { useProfile } from '@/lib/session';
import { answerConcern } from '@/lib/safety/respond';
import { atLeast, screenText } from '@/lib/safety/screen';
import { dark, gutter, hitTarget, space } from '@/theme/tokens';
import { useEntering } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

/**
 * Mirror — from day 3 (DESIGN.md: the reference's Void). A dark room:
 * suggested questions, then a conversation. It lives on this phone; each turn
 * is screened here first, and anything elevated or acute is never sent — the
 * crisis screen opens instead, as the protocol says the AI stops reflecting.
 */

const LIGHT = dark.ink;
const SOFT = dark.inkSoft;

type Note = { kind: 'care' | 'withheld' | 'quiet' | 'error'; text: string } | null;

export default function Mirror() {
  return (
    <Locked feature="mirror" promise="A place to think out loud, with something that has been paying attention.">
      <Room />
    </Locked>
  );
}

function Room() {
  const { colors } = useTheme();
  const personal = useProfile().consents.readings?.granted === true;
  const [status, setStatus] = useState<MirrorStatus | null>(null);
  const [messages, setMessages] = useState<MirrorMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const scroll = useRef<ScrollView>(null);

  const refresh = useCallback(() => {
    mirrorStatus()
      .then(setStatus)
      .catch(() => setStatus({ kind: 'offline' }));
  }, []);

  useEffect(() => {
    refresh();
    listMessages()
      .then(setMessages)
      .catch(err => console.warn('Mirror history unavailable:', err));
  }, [refresh]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setNote(null);

    const tier = screenText(body);
    if (atLeast(tier, 'elevated')) {
      // Not sent: the crisis screen answers this, not the AI.
      setText('');
      setNote({ kind: 'withheld', text: 'Mirror won’t reflect on this one. You deserve a person right now — help is open.' });
      answerConcern(tier, 'chat');
      return;
    }
    if (await reflectionsPaused().catch(() => false)) {
      setNote({ kind: 'quiet', text: 'Mirror is quiet for today. Calm, and help, are one tap away.' });
      return;
    }

    setSending(true);
    setText('');
    try {
      const mine = await addMessage('user', body);
      const history = [...messages, mine];
      setMessages(history);
      answerConcern(tier, 'chat');
      if (tier === 'low') setNote({ kind: 'care', text: 'That sounds heavy. If it gets heavier, help is under calm.' });

      const memory = await memoryForMirror(personal).catch(() => null);
      const { text: reply, sources } = citations(await askMirror(history, memory), memory);
      const theirs = await addMessage('mirror', reply, new Date(), sources);
      setMessages(m => [...m, theirs]);
    } catch (error) {
      if (error instanceof MirrorUnavailable) setStatus(error.status);
      else setNote({ kind: 'error', text: 'Mirror couldn’t answer just now. Your words are still here.' });
    } finally {
      setSending(false);
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
    }
  };

  const open = status?.kind === 'open';

  return (
    <Screen
      header={<AppHeader onVoid />}
      scroll={false}
      background={colors.void}
      contentStyle={styles.page}
    >
      <Starfield />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.feed}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Art name="eye" size={84} scheme="dark" style={styles.eye} />
          <Text variant="label" style={[styles.centre, { color: LIGHT }]} accessibilityRole="header">
            welcome to the mirror
          </Text>
          <Text variant="mono" style={[styles.centre, { color: SOFT }]}>
            software, not a person · not a therapist
          </Text>
          <VoidLink label="what the mirror knows" onPress={() => router.push('/memory')} />

          {status && !open && <Closed status={status} onRetry={refresh} />}

          {open && messages.length === 0 && <Topics onAsk={setText} />}

          {messages.map(m => (
            <View key={m.id} style={styles.message}>
              <Text
                variant={m.role === 'user' ? 'mono' : 'heading'}
                style={[{ color: m.role === 'user' ? SOFT : LIGHT }, m.role === 'user' && styles.mine]}
              >
                {m.content}
              </Text>
              {m.sources && m.sources.length > 0 && (
                <View style={styles.sources} accessible accessibilityLabel={`Drawn from: ${m.sources.map(s => s.text).join('; ')}`}>
                  <Text variant="mono" style={{ color: SOFT }}>
                    drawn from
                  </Text>
                  {m.sources.map(s => (
                    <Text key={s.id} variant="mono" style={{ color: SOFT }}>
                      {`· ${s.text}${s.receipt ? ` (${s.receipt})` : ''}`}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}

          {sending && (
            <Text variant="mono" style={{ color: SOFT }} accessibilityLabel="Mirror is answering">
              …
            </Text>
          )}

          {note && (
            <Text variant="bodyItalic" style={{ color: LIGHT }} accessibilityRole="alert">
              {note.text}
            </Text>
          )}

          {messages.length > 0 && !sending && (
            <VoidLink
              label="start over"
              onPress={async () => {
                await clearConversation().catch(() => undefined);
                setMessages([]);
                setNote(null);
              }}
            />
          )}
        </ScrollView>

        {open && (
          <View style={[styles.inputBar, { borderTopColor: dark.inkFaint }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="ASK ANYTHING…"
              placeholderTextColor={SOFT}
              accessibilityLabel="Ask Mirror"
              multiline
              maxLength={4000}
              maxFontSizeMultiplier={2}
              style={[styles.input, { color: LIGHT }]}
            />
            <SendButton onPress={send} disabled={!text.trim() || sending} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Closed({ status, onRetry }: { status: MirrorStatus; onRetry: () => void }) {
  const line: Record<Exclude<MirrorStatus['kind'], 'open'>, string> = {
    'no-consent': 'Mirror reflects on what you write, using an AI. That needs AI reflections turned on.',
    unavailable:
      'Mirror is resting for now. It opens once reflections are switched on for Lowkei — nothing you type here is sent until then.',
    offline: 'Mirror needs a connection. Anything already said is still here.'
  };
  if (status.kind === 'open') return null;

  return (
    <View style={styles.closed}>
      <Text variant="title" style={[styles.centre, { color: LIGHT }]}>
        {line[status.kind]}
      </Text>
      {status.kind === 'no-consent' && <VoidLink label="turn it on in you" onPress={() => router.push('/you')} />}
      {status.kind === 'offline' && <VoidLink label="try again" onPress={onRetry} />}
    </View>
  );
}

/** The reference's small light box at the end of the ask bar. */
function SendButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="send"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.send, { backgroundColor: LIGHT, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Text variant="action" style={{ color: dark.paper }}>
        send
      </Text>
    </Pressable>
  );
}

/**
 * The reference's Void: four themes, each a small picture in a square, the
 * chosen one ruled round; under it, that theme's questions to start from.
 */
function Topics({ onAsk }: { onAsk: (question: string) => void }) {
  const [topic, setTopic] = useState<TopicKey>('self');
  const enter = useEntering();
  const chosen = TOPICS.find(t => t.key === topic)!;

  return (
    <View style={styles.topics}>
      <View style={styles.topicRow} accessibilityRole="tablist">
        {TOPICS.map(t => {
          const active = t.key === topic;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              onPress={() => setTopic(t.key)}
              style={[styles.topic, { borderColor: active ? LIGHT : 'transparent' }]}
            >
              <Art name={t.art} size={34} scheme="dark" />
              <Text variant="label" style={{ color: active ? LIGHT : SOFT }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Animated.View key={topic} entering={enter} style={styles.suggestions}>
        {chosen.questions.map(q => (
          <VoidLink key={q} label={q} onPress={() => onAsk(q)} />
        ))}
      </Animated.View>
    </View>
  );
}

/** Underlined mono capitals in light ink — the room's only kind of control. */
function VoidLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.link, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <Text variant="action" style={[styles.centre, styles.underline, { color: LIGHT }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 },
  fill: { flex: 1 },
  feed: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.lg },
  centre: { textAlign: 'center' },
  eye: { alignSelf: 'center', marginTop: space.md },
  suggestions: { gap: space.sm, marginTop: space.md },
  topics: { gap: space.md, marginTop: space.lg },
  topicRow: { flexDirection: 'row', justifyContent: 'space-between' },
  topic: { alignItems: 'center', gap: space.xs + 2, paddingVertical: space.sm, width: '23%', borderWidth: 1 },
  closed: { gap: space.lg, marginTop: space.xl },
  mine: { textAlign: 'right' },
  message: { gap: space.sm },
  sources: { gap: 2, borderLeftWidth: 1, borderLeftColor: dark.inkFaint, paddingLeft: space.sm },
  link: { minHeight: hitTarget, justifyContent: 'center', alignSelf: 'center' },
  underline: { textDecorationLine: 'underline' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  input: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 13,
    maxHeight: 120,
    minHeight: hitTarget,
    paddingVertical: space.sm + 4,
    textAlignVertical: 'center'
  },
  send: { minHeight: 36, paddingHorizontal: space.md, justifyContent: 'center' }
});
