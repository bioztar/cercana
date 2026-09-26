import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { VoicePlayer } from '../components/VoicePlayer';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { Avatar, BigButton, ErrorText, Field } from '../components/ui';
import { markMessagesRead, sendMessage } from '../lib/api';
import { messageText, threadMessages, unreadIds, type Viewer } from '../lib/chats';
import { say } from '../lib/speech';
import type { Message, Person } from '../lib/types';
import { colors, fonts, radius, TARGET, type, typeFamily } from '../theme';

type Props = {
  circleId: string;
  viewer: Viewer;
  /** The family side of this pair. */
  person: Person;
  messages: Message[];
  /** false = a lead/admin reading someone else's thread. */
  canSend: boolean;
  /** Shown as a back arrow when the list is above this thread. */
  onBack?: () => void;
  group: string[];
};

/** One 1:1 thread. Bubbles match AssistantChat; a voice note shows its transcript under the player. */
export function ChatThread({ circleId, viewer, person, messages, canSend, onBack, group }: Props) {
  const big = viewer === 'patient';
  const t = big ? type : typeFamily;
  const thread = threadMessages(messages, person.id);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mine = (m: Message) => m.from_patient === (viewer === 'patient');

  // Opening the thread reads it (only the receiving side's own devices, never a lead peeking).
  const pending = canSend ? unreadIds(messages, person.id, viewer) : [];
  useEffect(() => {
    if (pending.length > 0) void markMessagesRead(pending).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the ids themselves
  }, [pending.join(',')]);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [thread.length]);

  const send = async (body: string | null, audioUrl: string | null, heard: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await sendMessage(circleId, {
        person_id: person.id, from_patient: viewer === 'patient', body, audio_url: audioUrl, transcript: heard,
      });
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={s.back}>
            <Text style={s.backIcon}>←</Text>
          </Pressable>
        ) : null}
        <Avatar uri={person.photo_url} name={person.name} size={big ? 56 : 44} group={group} />
        <Text style={[s.title, { fontSize: big ? type.name : typeFamily.title }]} numberOfLines={1}>{person.name}</Text>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.list}>
        {thread.length === 0 ? <Text style={[s.empty, { fontSize: t.body }]}>No messages yet. Say hello!</Text> : null}
        {thread.map((m) => {
          const text = messageText(m);
          return (
            <View key={m.id} style={mine(m) ? s.rowMe : s.rowThem}>
              <View style={[s.bubble, mine(m) ? s.bubbleMe : s.bubbleThem]}>
                {m.audio_url ? <VoicePlayer url={m.audio_url} /> : null}
                {text ? <Text style={[s.bubbleText, { fontSize: t.body }, mine(m) && s.bubbleTextMe]}>{text}</Text> : null}
                {text && big ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Play again" onPress={() => say(text)} style={s.replay}>
                    <Text style={s.replayIcon}>🔊</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <ErrorText message={error} />

      {canSend ? (
        <View style={s.composer}>
          {big ? (
            <VoiceRecorder size="big" idleLabel="Hold or tap to talk" disabled={busy} onError={setError} circleId={circleId}
              onDone={(clip) => send(null, clip.url, clip.transcript || null)} />
          ) : null}
          <View style={s.textRow}>
            {!big ? (
              <VoiceRecorder size="compact" disabled={busy} onError={setError} circleId={circleId}
                onDone={(clip) => send(null, clip.url, clip.transcript || null)} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Field label="" value={draft} onChangeText={setDraft} placeholder={big ? 'Or type here' : 'Write a message…'}
                onSubmitEditing={() => draft.trim() && send(draft.trim(), null, null)} />
            </View>
            <BigButton label="Send" onPress={() => send(draft.trim(), null, null)} busy={busy} disabled={!draft.trim()} style={s.sendBtn} />
          </View>
        </View>
      ) : (
        <Text style={s.readOnly}>You are reading this chat. Only {person.name} and Mom can write in it.</Text>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: colors.ink },
  title: { fontFamily: fonts.display, color: colors.ink, flex: 1 },
  list: { padding: 16, gap: 12, maxWidth: 700, width: '100%', alignSelf: 'center' },
  empty: { color: colors.inkSoft, lineHeight: 30 },
  rowThem: { alignItems: 'flex-start' },
  rowMe: { alignItems: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, padding: 14, gap: 10 },
  bubbleThem: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  bubbleMe: { backgroundColor: colors.terracotta },
  bubbleText: { lineHeight: 30, color: colors.ink },
  bubbleTextMe: { color: colors.white },
  replay: { minWidth: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
  replayIcon: { fontSize: 24 },
  composer: { padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: colors.line },
  textRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  sendBtn: { minHeight: TARGET, minWidth: 100 },
  readOnly: { padding: 16, fontSize: 16, color: colors.inkSoft, textAlign: 'center' },
});
