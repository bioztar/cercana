import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmDelete } from '../components/confirm';
import type { Person } from '../lib/types';
import { deletePerson, savePerson } from '../lib/api';
import { pickAndUploadPhoto } from '../lib/media';
import { birthdayToInput, normalizeBirthdayInput } from '../lib/util';
import { Avatar, BigButton, ErrorText, Field } from '../components/ui';
import { colors } from '../theme';

type Props = { circleId: string; people: Person[]; onChanged: () => void };

export function PeopleTab({ circleId, people, onChanged }: Props) {
  const [editing, setEditing] = useState<Partial<Person> | null>(null);
  if (editing) {
    return (
      <PersonForm
        circleId={circleId}
        initial={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); onChanged(); }}
      />
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <BigButton label="Add a person" onPress={() => setEditing({})} />
      {people.map((p) => (
        <Pressable key={p.id} onPress={() => setEditing(p)} style={s.row} accessibilityRole="button">
          <Avatar uri={p.photo_url} name={p.name} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{p.name}</Text>
            <Text style={s.sub}>{[p.relation, p.phone, p.birthday ? birthdayToInput(p.birthday) : null].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={s.edit}>Edit</Text>
        </Pressable>
      ))}
      {people.length === 0 && <Text style={s.sub}>No people yet. Add the first one.</Text>}
    </View>
  );
}

type FormProps = { circleId: string; initial: Partial<Person>; onClose: () => void; onSaved: () => void };

function PersonForm({ circleId, initial, onClose, onSaved }: FormProps) {
  const [name, setName] = useState(initial.name ?? '');
  const [relation, setRelation] = useState(initial.relation ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [birthday, setBirthday] = useState(birthdayToInput(initial.birthday));
  const [photo, setPhoto] = useState<string | null>(initial.photo_url ?? null);
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

  const pick = () => guard(async () => {
    const url = await pickAndUploadPhoto(true);
    if (url) setPhoto(url);
  });

  const save = () => guard(async () => {
    if (!name.trim()) throw new Error('Name is required.');
    const b = normalizeBirthdayInput(birthday);
    if (b === null) throw new Error('Birthday must look like 1990-03-05 (or 03-05 if the year is unknown).');
    await savePerson(circleId, {
      id: initial.id,
      name: name.trim(),
      relation: relation.trim() || null,
      phone: phone.trim() || null,
      photo_url: photo,
      birthday: b || null,
    });
    onSaved();
  });

  const remove = () => guard(async () => {
    if (!initial.id || !(await confirmDelete(`Delete ${name || 'this person'}?`))) return;
    await deletePerson(initial.id);
    onSaved();
  });

  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <Avatar uri={photo} name={name || '?'} size={140} />
        <BigButton label={photo ? 'Change photo' : 'Add photo'} tone="plain" onPress={pick} disabled={busy} />
      </View>
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label={'Relation, from their view (e.g. "your daughter")'} value={relation} onChangeText={setRelation} />
      <Field label="WhatsApp / phone (international, e.g. +34612345678)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Birthday (YYYY-MM-DD, or MM-DD)" value={birthday} onChangeText={setBirthday} autoCapitalize="none" />
      <ErrorText message={error} />
      <View style={{ gap: 12 }}>
        <BigButton label="Save" onPress={save} busy={busy} />
        <BigButton label="Cancel" tone="plain" onPress={onClose} disabled={busy} />
        {initial.id ? <BigButton label="Delete" tone="danger" onPress={remove} disabled={busy} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.line, minHeight: 72,
  },
  name: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 16, color: colors.inkSoft },
  edit: { fontSize: 18, fontWeight: '700', color: colors.terracotta, paddingHorizontal: 8 },
});
