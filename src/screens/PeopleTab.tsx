import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { Person } from '../lib/types';
import { setPersonRole, transferLead } from '../lib/api';
import { ROLE_LABEL, can, type Actor } from '../lib/permissions';
import { birthdayToInput, familyRelation } from '../lib/util';
import { Avatar, BigButton, ErrorText } from '../components/ui';
import { confirmAction } from '../components/confirm';
import { colors } from '../theme';
import { PersonForm } from './PersonForm';

type Props = { circleId: string; patientName: string; actor: Actor; people: Person[]; onChanged: () => void };

const target = (p: Person) => ({ id: p.id, role: p.role, claimed: p.claimed });

export function PeopleTab({ circleId, patientName, actor, people, onChanged }: Props) {
  const [editing, setEditing] = useState<Partial<Person> | null>(null);
  const [rolesFor, setRolesFor] = useState<string | null>(null); // person whose Roles panel is open
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      setRolesFor(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (editing) {
    const canDelete = !!editing.id && can(actor, { type: 'person.remove', target: target(editing as Person) });
    return (
      <PersonForm
        circleId={circleId}
        initial={editing}
        canDelete={canDelete}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); onChanged(); }}
      />
    );
  }

  const handOver = (p: Person, me: string) => run(async () => {
    const ok = await confirmAction(`Make ${p.name} the lead? You will become an admin.`, 'Hand over', false);
    if (ok) await transferLead(me, p.id);
  });

  return (
    <View style={{ gap: 12 }}>
      {can(actor, { type: 'person.add' }) ? (
        <BigButton label="Add a person" onPress={() => setEditing({})} />
      ) : (
        <Text style={s.sub}>You can edit your own profile. Ask an admin to add or change other people.</Text>
      )}
      <ErrorText message={error} />
      {people.map((p) => {
        const canEdit = can(actor, { type: 'person.edit', target: target(p) });
        const canMakeAdmin = can(actor, { type: 'person.setRole', target: target(p), role: 'admin' });
        const canHand = can(actor, { type: 'lead.handover', target: target(p) });
        const hasRoles = canMakeAdmin || canHand;
        const isMe = actor.kind === 'member' && actor.id === p.id;
        return (
          <View key={p.id} style={s.card}>
            <View style={s.row}>
              <Avatar uri={p.photo_url} name={p.name} size={64} />
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text style={s.name}>{p.name}{isMe ? ' (you)' : ''}</Text>
                  <Text style={[s.badge, p.role !== 'member' && s.badgeOn]}>{ROLE_LABEL[p.role]}</Text>
                </View>
                <Text style={s.sub}>
                  {[familyRelation(p.relation, patientName), p.phone, p.birthday ? birthdayToInput(p.birthday) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {!p.claimed ? <Text style={s.hint}>Profile only, not using the app</Text> : null}
              </View>
              <View>
                {canEdit ? (
                  <Pressable onPress={() => setEditing(p)} style={s.link} accessibilityRole="button">
                    <Text style={s.linkText}>Edit</Text>
                  </Pressable>
                ) : null}
                {hasRoles ? (
                  <Pressable onPress={() => setRolesFor(rolesFor === p.id ? null : p.id)} style={s.link} accessibilityRole="button">
                    <Text style={s.linkText}>Roles</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {rolesFor === p.id && (
              <View style={s.panel}>
                {canMakeAdmin ? (
                  <BigButton
                    label={p.role === 'admin' ? `Remove ${p.name} as admin` : `Make ${p.name} an admin`}
                    tone="plain"
                    onPress={() => run(() => setPersonRole(p.id, p.role === 'admin' ? 'member' : 'admin'))}
                  />
                ) : null}
                {canHand && actor.kind === 'member' && actor.id ? (
                  <BigButton label={`Make ${p.name} the lead`} tone="terracotta" onPress={() => handOver(p, actor.id as string)} />
                ) : null}
                {!p.claimed && p.role !== 'lead' ? (
                  <Text style={s.hint}>{p.name} has not joined yet, so cannot become the lead.</Text>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
      {people.length === 0 && <Text style={s.sub}>No people yet. Add the first one.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.line, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 22, fontWeight: '700', color: colors.ink },
  badge: {
    fontSize: 14, fontWeight: '700', color: colors.inkSoft, backgroundColor: colors.bg,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  badgeOn: { color: colors.white, backgroundColor: colors.terracotta },
  sub: { fontSize: 16, color: colors.inkSoft },
  hint: { fontSize: 15, color: colors.inkSoft, fontStyle: 'italic' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  linkText: { fontSize: 18, fontWeight: '700', color: colors.terracotta },
  panel: { gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
});
