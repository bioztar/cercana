import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../components/Text';
import type { Moment, Person } from '../lib/types';
import { authorOf } from '../lib/feed';
import { timeAgo } from '../lib/dates';
import { telUrl, whatsappUrl } from '../lib/util';
import { Avatar, BigButton } from '../components/ui';
import { colors, fonts, type } from '../theme';

type Photo = { url: string; caption: string | null; author: string; at: string };

function photosOf(person: Person, moments: Moment[], people: Person[]): Photo[] {
  const out: Photo[] = [];
  for (const m of moments) {
    if (m.person_id !== person.id && m.author_person_id !== person.id) continue;
    const author = authorOf(m, people)?.name ?? m.author ?? 'Someone';
    for (const url of [m.photo_url, ...(m.photo_urls ?? [])]) {
      if (url) out.push({ url, caption: m.body, author, at: m.created_at });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

type Props = { person: Person; moments: Moment[]; people: Person[]; onBack: () => void };

/** Tap a face on Mom's People tab → every photo posted by or about them (Vitaly, 2026-09-24 15:50). */
export function PersonPhotos({ person, moments, people, onBack }: Props) {
  const { width } = useWindowDimensions();
  const cols = width < 500 ? 2 : width < 900 ? 3 : 4;
  const photos = photosOf(person, moments, people);
  const [open, setOpen] = useState<Photo | null>(null);
  const cellWidth = Math.floor((Math.min(width, 900) - 40 - (cols - 1) * 10) / cols);

  if (open) {
    return (
      <View style={s.lightboxWrap}>
        <Image accessibilityLabel="Photo" source={{ uri: open.url }} style={s.lightboxPhoto} resizeMode="contain" />
        <View style={s.lightboxCaption}>
          {open.caption ? <Text style={s.lightboxText}>{open.caption}</Text> : null}
          <Text style={s.lightboxMeta}>{open.author} · {timeAgo(new Date(open.at), new Date())}</Text>
        </View>
        <BigButton label="Close" tone="plain" onPress={() => setOpen(null)} />
      </View>
    );
  }

  const wa = whatsappUrl(person.phone);
  const tel = telUrl(person.phone);
  const openUrl = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <BigButton label="‹ Back" tone="plain" onPress={onBack} style={s.back} />
      <View style={s.hero}>
        <Avatar uri={person.photo_url} name={person.name} size={100} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{person.name}</Text>
          {person.relation ? <Text style={s.relation}>{person.relation}</Text> : null}
        </View>
      </View>
      {(wa || tel) && (
        <View style={s.callRow}>
          {wa ? <BigButton label="Call on WhatsApp" style={s.callBtn} onPress={() => openUrl(wa)} /> : null}
          {tel ? <BigButton label="Phone call" tone="plain" style={s.callBtn} onPress={() => openUrl(tel)} /> : null}
        </View>
      )}
      <Text style={s.sectionLabel}>Photos</Text>
      {photos.length === 0 ? (
        <Text style={s.empty}>No photos yet.</Text>
      ) : (
        <View style={s.grid}>
          {photos.map((p, i) => (
            <Pressable key={i} accessibilityRole="button" accessibilityLabel={p.caption ?? 'Photo'} onPress={() => setOpen(p)}>
              <Image accessibilityLabel="Photo" source={{ uri: p.url }} style={[s.cell, { width: cellWidth, height: cellWidth }]} />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: 940, width: '100%', alignSelf: 'center', gap: 16 },
  back: { alignSelf: 'flex-start' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink },
  relation: { fontSize: type.label, color: colors.inkSoft, marginTop: 2 },
  callRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  callBtn: { flexGrow: 1, flexBasis: 220 },
  sectionLabel: { fontSize: type.label, fontFamily: fonts.display, color: colors.ink },
  empty: { fontSize: type.body, color: colors.inkSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { borderRadius: 12, backgroundColor: colors.line },
  lightboxWrap: { flex: 1, backgroundColor: colors.ink, padding: 20, gap: 16, justifyContent: 'center' },
  lightboxPhoto: { width: '100%', height: '70%' },
  lightboxCaption: { gap: 4 },
  lightboxText: { fontSize: type.body, color: colors.white, lineHeight: 30 },
  lightboxMeta: { fontSize: 16, color: colors.peach },
});
