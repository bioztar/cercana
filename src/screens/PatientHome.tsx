import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Person, Session } from '../lib/types';
import { birthdayPhrase, formatDate, greeting, upcomingBirthday } from '../lib/dates';
import { getFlag, setFlag } from '../lib/session';
import { say } from '../lib/speech';
import { scheduleBirthdayReminders } from '../lib/notify';
import { Avatar, BigButton, ErrorText } from '../components/ui';
import { colors, MAX_WIDTH, type } from '../theme';

let greetedThisOpen = false; // greeting is spoken once per app-open

type Props = {
  session: Session;
  people: Person[];
  error: string | null;
  onOpenPerson: (id: string) => void;
  onSettings: () => void;
};

export function PatientHome({ session, people, error, onOpenPerson, onSettings }: Props) {
  const { width } = useWindowDimensions();
  const cols = width < 700 ? 2 : width < 1000 ? 3 : 4;
  const now = new Date();
  const hello = `${greeting(now)}, ${session.patientName}`;
  const dateLine = formatDate(now);

  const next = useMemo(() => upcomingBirthday(people, new Date(), 7), [people]);
  const bannerText = next ? birthdayPhrase(next.person.name, next.days, new Date(), next.birthday) : null;
  const bannerFull = next && bannerText
    ? `${bannerText}${next.person.relation ? ` — ${next.person.relation}` : ''}`
    : null;

  useEffect(() => {
    if (greetedThisOpen) return;
    greetedThisOpen = true;
    say(`${hello}. Today is ${dateLine}.`);
  }, [hello, dateLine]);

  useEffect(() => {
    if (!bannerFull) return;
    const key = `bday-spoken-${new Date().toDateString()}`;
    void getFlag(key).then((seen) => {
      if (seen) return;
      void setFlag(key, '1');
      say(bannerFull);
    });
  }, [bannerFull]);

  useEffect(() => {
    void scheduleBirthdayReminders(people);
  }, [people]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>{hello}</Text>
          <Text style={s.date}>{dateLine}</Text>
        </View>
        <BigButton label="🔊 Read aloud" tone="terracotta" onPress={() => say(`${hello}. Today is ${dateLine}.`)} />
      </View>

      {next && bannerFull && (
        <Pressable accessibilityRole="button" accessibilityLabel={bannerFull} onPress={() => onOpenPerson(next.person.id)} style={s.banner}>
          <Avatar uri={next.person.photo_url} name={next.person.name} size={96} />
          <Text style={s.bannerText}>{bannerFull}</Text>
        </Pressable>
      )}

      <ErrorText message={error} />

      {people.length === 0 && !error && (
        <Text style={s.empty}>Your family will add the people you love here.</Text>
      )}

      <View style={s.grid}>
        {people.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}${p.relation ? `, ${p.relation}` : ''}`}
            onPress={() => onOpenPerson(p.id)}
            style={[s.card, { width: `${100 / cols - 2}%` }]}
          >
            <Avatar uri={p.photo_url} name={p.name} size={cols === 2 ? Math.min(180, width / 2 - 48) : 200} />
            <Text style={s.name} numberOfLines={2}>{p.name}</Text>
            {p.relation ? <Text style={s.relation} numberOfLines={2}>{p.relation}</Text> : null}
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={onSettings} style={s.settings}>
        <Text style={s.settingsText}>Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 20 },
  hello: { fontSize: type.huge, fontWeight: '800', color: colors.ink, lineHeight: 56 },
  date: { fontSize: type.title, color: colors.inkSoft, fontWeight: '600', marginTop: 4 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.warm,
    borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 3, borderColor: colors.terracotta, minHeight: 64,
  },
  bannerText: { flex: 1, fontSize: 30, fontWeight: '800', color: colors.ink, lineHeight: 38 },
  empty: { fontSize: type.body, color: colors.inkSoft, marginVertical: 32, lineHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
  card: {
    backgroundColor: colors.card, borderRadius: 20, padding: 12, alignItems: 'center',
    borderWidth: 2, borderColor: colors.line,
  },
  name: { fontSize: type.name, fontWeight: '800', color: colors.ink, marginTop: 10, textAlign: 'center' },
  relation: { fontSize: type.label, color: colors.inkSoft, textAlign: 'center', marginTop: 2 },
  settings: { alignSelf: 'center', minHeight: 64, justifyContent: 'center', marginTop: 32, paddingHorizontal: 24 },
  settingsText: { fontSize: 20, color: colors.inkSoft, textDecorationLine: 'underline' },
});
