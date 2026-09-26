import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { Avatar } from '../components/ui';
import { chatSummaries, lastLine, visibleChatPeople, type Viewer } from '../lib/chats';
import { can, type Actor } from '../lib/permissions';
import { useMessages } from '../lib/useMessages';
import type { Person } from '../lib/types';
import { colors, fonts, MAX_WIDTH, type, typeFamily } from '../theme';
import { ChatThread } from './ChatThread';

type Props = { circleId: string; viewer: Viewer; people: Person[]; actor: Actor };

/**
 * The Chats tab. Mom: a big list of her people → a thread. Family: their one thread with Mom
 * (opens straight away); lead/admin get the list of every thread and can read them all, but only
 * write in their own.
 */
export function ChatsTab({ circleId, viewer, people, actor }: Props) {
  const { messages } = useMessages(circleId);
  const [openId, setOpenId] = useState<string | null>(null);
  const big = viewer === 'patient';
  const t = big ? type : typeFamily;
  const names = people.map((p) => p.name);
  const meId = actor.kind === 'member' ? actor.id : null;

  const listed = big ? people : visibleChatPeople(people, meId, can(actor, { type: 'chat.viewAll' }));
  const soleThread = !big && listed.length === 1 ? listed[0] : null;
  const open = soleThread ?? people.find((p) => p.id === openId) ?? null;

  if (open) {
    return (
      <ChatThread circleId={circleId} viewer={viewer} person={open} messages={messages} group={names}
        canSend={big || open.id === meId} onBack={soleThread ? undefined : () => setOpenId(null)} />
    );
  }

  if (!big && listed.length === 0) {
    return (
      <View style={s.wrap}>
        <Text style={[s.title, { fontSize: t.title }]}>Chats</Text>
        <Text style={[s.note, { fontSize: t.body }]}>Pick who you are in Settings to chat with {'Mom'}.</Text>
      </View>
    );
  }

  const rows = chatSummaries(listed, messages, viewer);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={[s.title, { fontSize: t.title }]}>Chats</Text>
      {rows.map(({ person: p, last, unread }) => (
        <Pressable key={p.id} accessibilityRole="button"
          accessibilityLabel={`${p.name}${unread ? `, ${unread} new` : ''}`}
          onPress={() => setOpenId(p.id)} style={[s.row, unread > 0 && s.rowUnread]}>
          <Avatar uri={p.photo_url} name={p.name} size={big ? 72 : 52} group={names} />
          <View style={s.mid}>
            <Text style={[s.name, { fontSize: big ? type.name : typeFamily.title }]} numberOfLines={1}>{p.name}</Text>
            <Text style={[s.last, { fontSize: t.label }]} numberOfLines={1}>{last ? lastLine(last) : 'Say hello'}</Text>
          </View>
          {unread > 0 ? <View accessibilityLabel="New messages" style={s.dot} /> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center', gap: 14 },
  title: { fontFamily: fonts.display, color: colors.ink },
  note: { color: colors.inkSoft, lineHeight: 30 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 88, padding: 12, backgroundColor: colors.card,
    borderRadius: 20, borderWidth: 2, borderColor: colors.line,
  },
  rowUnread: { borderColor: colors.terracotta },
  mid: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, color: colors.ink },
  last: { color: colors.inkSoft, marginTop: 2 },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.terracotta },
});
