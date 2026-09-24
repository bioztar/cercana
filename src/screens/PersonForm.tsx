import React, { useState } from 'react';
import { View } from 'react-native';
import type { Person } from '../lib/types';
import { deletePerson, savePerson } from '../lib/api';
import { pickAndUploadPhoto } from '../lib/media';
import { birthdayToInput, normalizeBirthdayInput } from '../lib/util';
import { Avatar, BigButton, ErrorText, Field } from '../components/ui';
import { confirmDelete } from '../components/confirm';

type Props = {
  circleId: string;
  initial: Partial<Person>;
  canDelete: boolean; // from permissions.can(actor, person.remove)
  onClose: () => void;
  onSaved: () => void;
};

/** Add / edit a profile: photo, name, relation, phone, birthday. Who may open it is decided by the caller via can(). */
export function PersonForm({ circleId, initial, canDelete, onClose, onSaved }: Props) {
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
        {initial.id && canDelete ? <BigButton label="Delete" tone="danger" onPress={remove} disabled={busy} /> : null}
      </View>
    </View>
  );
}
