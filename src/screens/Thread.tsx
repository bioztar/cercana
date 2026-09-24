import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addComment, listComments } from '../lib/api';
import { aboutOf, authorOf } from '../lib/feed';
import { timeAgo } from '../lib/dates';
import type { Comment, EventRow, Moment, Person } from '../lib/types';
import { Avatar, BigButton, ErrorText, Field } from '../components/ui';
import { VoicePlayer } from '../components/VoicePlayer';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { colors, type } from '../theme';

type Props = {
  moment: Moment;
  people: Person[];
  events: EventRow[];
  /** Who is replying: Mom (patient) or a family member's claimed profile. */
  authorId: string | null;
  authorName: string;
  isPatient: boolean;
  onBack: () => void;
};

export function Thread({ moment: m, people, events, authorId, authorName, isPatient, onBack }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => listComments(m.id).then(setComments).catch((e) => setError(String(e)));
  useEffect(() => { void load(); }, [m.id]);

  const author = authorOf(m, people);
  const about = aboutOf(m, people);
  const event = m.event_id ? events.find((e) => e.id === m.event_id) : undefined;

  const post = async (body: string | null, audioUrl: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await addComment(m.circle_id, { moment_id: m.id, author_person_id: authorId, author_name: authorName, body, audio_url: audioUrl });
      setText('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <BigButton label="← Feed" tone="plain" onPress={onBack} style={s.back} />

      <View style={s.header}>
        {m.photo_url ? <Image accessibilityLabel="Photo" source={{ uri: m.photo_url }} style={s.photo} /> : null}
        {m.body ? <Text style={s.headline}>{m.body}</Text> : null}
        <Text style={s.meta}>
          {[author?.name ?? m.author, about ? `about ${about.name}` : null, timeAgo(new Date(m.created_at), new Date())]
            .filter(Boolean).join(' · ')}
        </Text>
        {event ? <Text style={s.event}>📅 {event.title ?? 'Event'}</Text> : null}
        {m.audio_url ? <VoicePlayer url={m.audio_url} /> : null}
      </View>

      <View style={s.list}>
        {comments.map((c) => {
          const by = c.author_person_id ? people.find((p) => p.id === c.author_person_id) : undefined;
          const name = by?.name ?? c.author_name ?? 'Someone';
          return (
            <View key={c.id} style={s.comment}>
              <Avatar uri={by?.photo_url} name={name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.commentName}>{name} · {timeAgo(new Date(c.created_at), new Date())}</Text>
                {c.body ? <Text style={s.commentBody}>{c.body}</Text> : null}
                {c.audio_url ? <VoicePlayer url={c.audio_url} /> : null}
              </View>
            </View>
          );
        })}
        {comments.length === 0 ? <Text style={s.empty}>No replies yet.</Text> : null}
      </View>

      <ErrorText message={error} />

      {isPatient ? (
        <View style={s.replyBig}>
          <Text style={s.replyLabel}>Send a reply</Text>
          <VoiceRecorder
            onDone={(clip) => post(clip.transcript || null, clip.url)}
            onError={setError}
            disabled={busy}
          />
          <Field label="Or type instead" value={text} onChangeText={setText} multiline />
          {text.trim() ? <BigButton label="Send" onPress={() => post(text.trim(), null)} busy={busy} /> : null}
        </View>
      ) : (
        <View style={s.replySmall}>
          <Field label="Reply" value={text} onChangeText={setText} multiline placeholder="Write a reply…" />
          <View style={s.row}>
            <VoiceRecorder size="compact" onDone={(clip) => post(clip.transcript || null, clip.url)} onError={setError} disabled={busy} />
            <BigButton label="Send" onPress={() => post(text.trim() || null, null)} busy={busy} disabled={!text.trim()} style={s.grow} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, gap: 16, maxWidth: 700, width: '100%', alignSelf: 'center' },
  back: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 16 },
  header: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10, borderWidth: 2, borderColor: colors.line },
  photo: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.line },
  headline: { fontSize: type.name, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 18, color: colors.inkSoft },
  event: { fontSize: 18, fontWeight: '700', color: colors.terracotta },
  list: { gap: 12 },
  comment: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line },
  commentName: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  commentBody: { fontSize: type.label, color: colors.ink, lineHeight: 28 },
  empty: { fontSize: 18, color: colors.inkSoft },
  replyBig: { alignItems: 'center', gap: 12, backgroundColor: colors.peachSoft, borderRadius: 20, padding: 20 },
  replyLabel: { fontSize: type.title, fontWeight: '800', color: colors.ink },
  replySmall: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
});
