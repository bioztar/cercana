import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { claimPerson, findCircleByCode, listPeople, savePerson } from '../lib/api';
import { pickAndUploadPhoto } from '../lib/media';
import { familyRelation } from '../lib/util';
import type { Circle, Person, Session } from '../lib/types';
import { Avatar, BigButton, ErrorText, Field } from '../components/ui';
import { colors, type } from '../theme';

type Props = { code: string; onDone: (s: Session) => void; onCancel: () => void };

const sessionFor = (circle: Circle, p: Person): Session => ({
  role: 'family', circleId: circle.id, code: circle.code, patientName: circle.patient_name,
  memberName: p.name, memberId: p.id, relation: p.relation ?? undefined,
});

/** Invite landing: "Which one are you?" — claim an existing profile or create your own. No login. */
export function Join({ code, onDone, onCancel }: Props) {
  const [circle, setCircle] = useState<Circle | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const c = await findCircleByCode(code);
      if (!c) throw new Error('That invite code was not found. Ask your family to send it again.');
      setCircle(c);
      setPeople((await listPeople(c.id)).filter((p) => !p.claimed));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const claim = async (p: Person) => {
    if (!circle) return;
    setBusy(true);
    setError(null);
    try {
      onDone(sessionFor(circle, await claimPerson(p.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPicked(null);
      await load(); // somebody may have taken it: show the fresh list
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.brand}>Cercana</Text>
      {loading ? <ActivityIndicator size="large" color={colors.terracotta} /> : null}
      {!loading && !circle ? (
        <View style={s.stack}>
          <ErrorText message={error} />
          <BigButton label="Back" tone="plain" onPress={onCancel} />
        </View>
      ) : null}
      {!loading && circle && !creating ? (
        <View style={s.stack}>
          <Text style={s.title}>{circle.patient_name}'s family</Text>
          <Text style={s.body}>Which one are you?</Text>
          <ErrorText message={error} />
          {people.map((p) => (
            <View key={p.id} style={[s.row, picked === p.id && s.rowOn]}>
              <Pressable onPress={() => setPicked(picked === p.id ? null : p.id)} accessibilityRole="button" style={s.rowTop}>
                <Avatar uri={p.photo_url} name={p.name} size={72} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{p.name}</Text>
                  {p.relation ? <Text style={s.sub}>{familyRelation(p.relation, circle.patient_name)}</Text> : null}
                </View>
              </Pressable>
              {picked === p.id ? (
                <View style={{ gap: 10 }}>
                  <BigButton label={`Yes, I'm ${p.name}`} onPress={() => claim(p)} busy={busy} />
                  <BigButton label="No" tone="plain" onPress={() => setPicked(null)} disabled={busy} />
                </View>
              ) : null}
            </View>
          ))}
          {people.length === 0 ? <Text style={s.sub}>Every profile is already taken.</Text> : null}
          <BigButton label="I'm not on the list" tone="terracotta" onPress={() => setCreating(true)} />
          <BigButton label="Back" tone="plain" onPress={onCancel} />
        </View>
      ) : null}
      {circle && creating ? (
        <NewProfile
          circle={circle}
          onCancel={() => setCreating(false)}
          onCreated={(p) => onDone(sessionFor(circle, p))}
        />
      ) : null}
    </ScrollView>
  );
}

function NewProfile({ circle, onCancel, onCreated }: { circle: Circle; onCancel: () => void; onCreated: (p: Person) => void }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => guard(async () => {
    if (!name.trim()) throw new Error('Please type your name.');
    const p = await savePerson(
      circle.id,
      { name: name.trim(), relation: relation.trim() || null, phone: phone.trim() || null, photo_url: photo, birthday: null },
      { claimed: true },
    );
    onCreated(p);
  });

  return (
    <View style={s.stack}>
      <Text style={s.title}>Add yourself</Text>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar uri={photo} name={name || '?'} size={120} />
        <BigButton label={photo ? 'Change photo' : 'Add photo'} tone="plain" disabled={busy}
          onPress={() => guard(async () => { const u = await pickAndUploadPhoto(true); if (u) setPhoto(u); })} />
      </View>
      <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label={`Relation, from ${circle.patient_name}'s view (e.g. "your grandson")`} value={relation} onChangeText={setRelation} />
      <Field label="WhatsApp / phone (international, e.g. +34612345678)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <ErrorText message={error} />
      <BigButton label="Join" onPress={save} busy={busy} />
      <BigButton label="Back" tone="plain" onPress={onCancel} disabled={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 24, alignSelf: 'center', width: '100%', maxWidth: 640 },
  brand: { fontSize: 20, fontWeight: '700', color: colors.terracotta, marginBottom: 12, letterSpacing: 2 },
  stack: { gap: 14 },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, lineHeight: 48 },
  body: { fontSize: type.body, color: colors.ink },
  row: { backgroundColor: colors.card, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: colors.line, gap: 12 },
  rowOn: { borderColor: colors.green },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72 },
  name: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 18, color: colors.inkSoft },
});
