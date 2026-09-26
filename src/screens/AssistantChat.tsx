import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { BigButton, Field } from '../components/ui';
import { addEvent, askAssistant, ensureFamilyCalendar } from '../lib/api';
import { say } from '../lib/speech';
import { uuidv4 } from '../lib/util';
import { deviceTz, proposalToEvent } from '../lib/voice';
import type { AssistantProposal } from '../lib/types';
import { colors, fonts, radius, TARGET, type } from '../theme';

type Bubble = { id: string; from: 'assistant' | 'me'; text: string; proposal?: AssistantProposal; cardDone?: boolean };

type Props = { circleId: string; onBack: () => void; onEventAdded?: () => void };

const WELCOME = "I'm here. Ask me about your family, your day or your medicines, or tell me something to add to your calendar.";
const OFFLINE = "I couldn't reach my thoughts just now. Please try again in a moment.";

/** Carmen's "Chat with assistant": the `assistant` edge function answers from her circle's data; a proposed
 * event comes back as a Yes/No card and Yes saves it to her calendar (demo mode uses the offline script). */
export function AssistantChat({ circleId, onBack, onEventAdded }: Props) {
  const [messages, setMessages] = useState<Bubble[]>([{ id: uuidv4(), from: 'assistant', text: WELCOME }]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { say(WELCOME); }, []);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages, thinking]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const history = messages.slice(-8).map((b) => ({ role: b.from === 'me' ? ('user' as const) : ('assistant' as const), text: b.text }));
    setMessages((cur) => [...cur, { id: uuidv4(), from: 'me', text: trimmed }]);
    setThinking(true);
    try {
      const a = await askAssistant({
        circle_id: circleId, speaker_person_id: null, mode: 'chat', text: trimmed, history,
        now: new Date().toISOString(), tz: deviceTz(),
      });
      setMessages((cur) => [...cur, { id: uuidv4(), from: 'assistant', text: a.reply, proposal: a.proposal }]);
      say(a.reply);
    } catch (e) {
      console.warn('assistant failed', e);
      setMessages((cur) => [...cur, { id: uuidv4(), from: 'assistant', text: OFFLINE }]);
      say(OFFLINE);
    } finally {
      setThinking(false);
    }
  };

  const sendText = () => {
    if (!draft.trim()) return;
    void send(draft);
    setDraft('');
  };

  const answerCard = async (b: Bubble, yes: boolean) => {
    setMessages((cur) => cur.map((m) => (m.id === b.id ? { ...m, cardDone: true } : m)));
    let text = "Okay, I won't add it.";
    if (yes && b.proposal) {
      try {
        const calendarId = await ensureFamilyCalendar(circleId);
        await addEvent(circleId, calendarId, proposalToEvent(b.proposal), null); // null = Carmen added it herself
        onEventAdded?.();
        text = "Done. It's on your calendar, and your family can see it.";
      } catch (e) {
        console.warn('save event failed', e);
        text = "I couldn't save that. Please try again.";
        setMessages((cur) => cur.map((m) => (m.id === b.id ? { ...m, cardDone: false } : m)));
      }
    }
    setMessages((cur) => [...cur, { id: uuidv4(), from: 'assistant', text }]);
    say(text);
  };

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={s.back}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <Text style={s.title}>Assistant</Text>
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
            {m.proposal && !m.cardDone && (
              <View style={s.cardRow}>
                <BigButton label="Yes" tone="green" onPress={() => void answerCard(m, true)} style={s.cardBtn} />
                <BigButton label="No" tone="plain" onPress={() => void answerCard(m, false)} style={s.cardBtn} />
              </View>
            )}
          </View>
        ))}
        {thinking && (
          <View style={s.rowThem}>
            <View style={[s.bubble, s.bubbleThem]}><Text style={s.bubbleText}>…</Text></View>
          </View>
        )}
      </ScrollView>

      <View style={s.composer}>
        <VoiceRecorder size="big" circleId={circleId} idleLabel="Hold or tap to talk" onDone={(clip) => void send(clip.transcript)} onError={() => {}} />
        <View style={s.textRow}>
          <View style={{ flex: 1 }}>
            <Field label="" value={draft} onChangeText={setDraft} placeholder="Or type here" onSubmitEditing={sendText} />
          </View>
          <BigButton label="Send" onPress={sendText} disabled={!draft.trim() || thinking} style={s.sendBtn} />
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
