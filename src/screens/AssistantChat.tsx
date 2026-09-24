import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { BigButton, Field } from '../components/ui';
import { reply, type AssistantCard } from '../lib/assistantScript';
import { say } from '../lib/speech';
import { uuidv4 } from '../lib/util';
import type { EventRow, Person } from '../lib/types';
import { colors, fonts, radius, TARGET, type } from '../theme';

type Bubble = { id: string; from: 'assistant' | 'me'; text: string; card?: AssistantCard; cardDone?: boolean };

type Props = { people: Person[]; events: EventRow[]; onBack: () => void };

const WELCOME = "I'm here. I can add things to your calendar or tell your family something.";

/** Carmen's "Chat with assistant" (Vitaly, 2026-09-24): scripted replies only — no LLM, no network,
 * nothing written to the database. The real STT → LLM → TTS agent is a later mission. */
export function AssistantChat({ people, events, onBack }: Props) {
  const [messages, setMessages] = useState<Bubble[]>([{ id: uuidv4(), from: 'assistant', text: WELCOME }]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { say(WELCOME); }, []);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages]);

  const send = (text: string) => {
    const trimmed = text.trim();
    const me: Bubble = { id: uuidv4(), from: 'me', text: trimmed || 'Voice message' };
    const r = reply(trimmed, new Date(), { people, events });
    const assistant: Bubble = { id: uuidv4(), from: 'assistant', text: r.text, card: r.card };
    setMessages((cur) => [...cur, me, assistant]);
    say(r.text);
  };

  const sendText = () => {
    if (!draft.trim()) return;
    send(draft);
    setDraft('');
  };

  const answerCard = (id: string, yes: boolean) => {
    setMessages((cur) => [
      ...cur.map((b) => (b.id === id ? { ...b, cardDone: true } : b)),
      { id: uuidv4(), from: 'assistant', text: yes ? 'Added ✓ (preview — not saved yet)' : "Okay, I won't add it." },
    ]);
    say(yes ? 'Added. This is only a preview, nothing was saved yet.' : "Okay, I won't add it.");
  };

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={s.back}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <Text style={s.title}>Assistant</Text>
        <View style={s.pill}><Text style={s.pillText}>preview</Text></View>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.list}>
        {messages.map((m) => (
          <View key={m.id} style={m.from === 'me' ? s.rowMe : s.rowThem}>
            <View style={[s.bubble, m.from === 'me' ? s.bubbleMe : s.bubbleThem]}>
              <Text style={[s.bubbleText, m.from === 'me' && s.bubbleTextMe]}>{m.text}</Text>
              {m.from === 'assistant' && (
                <Pressable accessibilityRole="button" accessibilityLabel="Play again" onPress={() => say(m.text)} style={s.replay}>
                  <Text style={s.replayIcon}>🔊</Text>
                </Pressable>
              )}
            </View>
            {m.card && !m.cardDone && (
              <View style={s.cardRow}>
                <BigButton label="Yes" tone="green" onPress={() => answerCard(m.id, true)} style={s.cardBtn} />
                <BigButton label="No" tone="plain" onPress={() => answerCard(m.id, false)} style={s.cardBtn} />
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={s.composer}>
        <VoiceRecorder size="big" upload={false} idleLabel="Hold or tap to talk" onDone={(clip) => send(clip.transcript)} onError={() => {}} />
        <View style={s.textRow}>
          <View style={{ flex: 1 }}>
            <Field label="" value={draft} onChangeText={setDraft} placeholder="Or type here" onSubmitEditing={sendText} />
          </View>
          <BigButton label="Send" onPress={sendText} disabled={!draft.trim()} style={s.sendBtn} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: colors.ink },
  title: { fontSize: type.name, fontFamily: fonts.display, color: colors.ink, flex: 1 },
  pill: { backgroundColor: colors.peach, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: type.label - 6, fontWeight: '800', color: colors.terracottaDark, textTransform: 'uppercase' },
  list: { padding: 16, gap: 12 },
  rowThem: { alignItems: 'flex-start', gap: 8 },
  rowMe: { alignItems: 'flex-end', gap: 8 },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bubbleThem: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  bubbleMe: { backgroundColor: colors.terracotta },
  bubbleText: { fontSize: type.body, lineHeight: 30, color: colors.ink, flexShrink: 1 },
  bubbleTextMe: { color: colors.white },
  replay: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  replayIcon: { fontSize: 24 },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardBtn: { minWidth: 100 },
  composer: { padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: colors.line },
  textRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  sendBtn: { minHeight: TARGET, minWidth: 100 },
});
