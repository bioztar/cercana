import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Medication } from '../lib/types';
import { createMedication, updateMedication } from '../lib/api';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors } from '../theme';

type Props = { circleId: string; createdByPersonId: string | null; medications: Medication[]; onClose: () => void; onChanged: () => void };

const PRESET_TIMES = ['08:00', '14:00', '20:00'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_TIMES = 4;

/** Family: add a medicine (name, dose, 1-4 times), or edit/deactivate an existing one. Gated by
 * `permissions.can(actor, { type: 'medication.manage' })` — lead/admin only (see FamilyDashboard). */
export function MedicationsManage({ circleId, createdByPersonId, medications, onClose, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [times, setTimes] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDose('');
    setTimes([]);
    setCustomTime('');
    setError(null);
  };

  const edit = (m: Medication) => {
    setEditingId(m.id);
    setName(m.name);
    setDose(m.dose);
    setTimes(m.times);
    setError(null);
  };

  const toggleTime = (t: string) => setTimes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < MAX_TIMES ? [...cur, t].sort() : cur));

  const addCustomTime = () => {
    const t = customTime.trim();
    if (!TIME_RE.test(t)) return setError('Time must be HH:MM (24-hour), e.g. 09:30.');
    if (times.length >= MAX_TIMES) return setError(`A medicine can have at most ${MAX_TIMES} times a day.`);
    setTimes((cur) => (cur.includes(t) ? cur : [...cur, t].sort()));
    setCustomTime('');
    setError(null);
  };

  const save = async () => {
    if (!name.trim()) return setError('Give the medicine a name, e.g. "Blood pressure pill".');
    if (!dose.trim()) return setError('How much, e.g. "1 pill".');
    if (times.length === 0) return setError('Pick at least one time.');
    setBusy(true);
    setError(null);
    try {
      const input = { name: name.trim(), dose: dose.trim(), times, created_by_person_id: createdByPersonId };
      if (editingId) await updateMedication(editingId, input);
      else await createMedication(circleId, input);
      resetForm();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (m: Medication) => {
    setBusy(true);
    try {
      await updateMedication(m.id, { active: !m.active });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={s.title}>{editingId ? 'Edit medicine' : 'Add a medicine'}</Text>
      <Field label="Name (e.g. Blood pressure pill)" value={name} onChangeText={setName} autoCapitalize="sentences" />
      <Field label="Dose (e.g. 1 pill)" value={dose} onChangeText={setDose} autoCapitalize="none" />
      <Text style={s.label}>Times</Text>
      <View style={s.chips}>
        {[...new Set([...PRESET_TIMES, ...times])].sort().map((t) => (
          <Pressable key={t} accessibilityRole="button" onPress={() => toggleTime(t)} style={[s.chip, times.includes(t) && s.chipOn]}>
            <Text style={[s.chipText, times.includes(t) && s.chipTextOn]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.customRow}>
        <View style={{ flex: 1 }}>
          <Field label="Custom time (HH:MM)" value={customTime} onChangeText={setCustomTime} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
        </View>
        <Pressable accessibilityRole="button" onPress={addCustomTime} style={s.addTimeBtn}>
          <Text style={s.addTimeText}>+ Add</Text>
        </Pressable>
      </View>
      <ErrorText message={error} />
      <View style={{ gap: 12, marginBottom: 24 }}>
        <BigButton label={editingId ? 'Save changes' : 'Save'} onPress={save} busy={busy} />
        {editingId ? (
          <Pressable onPress={resetForm} accessibilityRole="button" style={s.cancel}>
            <Text style={s.cancelText}>Cancel edit</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={s.title}>Medicines</Text>
      {medications.length === 0 && <Text style={s.empty}>No medicines yet.</Text>}
      {medications.map((m) => (
        <View key={m.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowTitle, !m.active && s.rowTitleOff]}>{m.name} — {m.dose}</Text>
            <Text style={s.rowTimes}>{m.times.join(' · ')}{m.active ? '' : ' · inactive'}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => edit(m)} style={s.rowBtn}>
            <Text style={s.rowBtnText}>Edit</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => toggleActive(m)} style={s.rowBtn} disabled={busy}>
            <Text style={s.rowBtnText}>{m.active ? 'Deactivate' : 'Reactivate'}</Text>
          </Pressable>
        </View>
      ))}

      <Pressable onPress={onClose} accessibilityRole="button" style={[s.cancel, { marginTop: 16 }]}>
        <Text style={s.cancelText}>Done</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 2, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { borderColor: colors.terracotta, backgroundColor: colors.peachSoft },
  chipText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  chipTextOn: { color: colors.terracottaDark },
  customRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  addTimeBtn: { minHeight: 52, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  addTimeText: { fontSize: 16, fontWeight: '700', color: colors.terracotta },
  cancel: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  cancelText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
  empty: { fontSize: 16, color: colors.inkSoft, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  rowTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  rowTitleOff: { color: colors.inkSoft, textDecorationLine: 'line-through' },
  rowTimes: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  rowBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  rowBtnText: { fontSize: 14, fontWeight: '700', color: colors.terracotta },
});
