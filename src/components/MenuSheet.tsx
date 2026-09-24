import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { HoldButton } from './HoldButton';
import { colors, fonts, radius, TARGET, typeFamily } from '../theme';

export type MenuItem = { label: string; onPress: () => void; hold?: boolean };

type Props = { visible: boolean; onClose: () => void; items: MenuItem[]; title: string };

/** The ☰ menu everything-else lives behind, on both Mom's and the family's home (Vitaly,
 * 2026-09-24 15:40): only feed + a few bottom tabs stay on the surface. A plain row closes on tap
 * and runs its action; a `hold` row (Settings) keeps its press-and-hold guard inside the menu. */
export function MenuSheet({ visible, onClose, items, title }: Props) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={s.card}>
        <View style={s.top}>
          <Text style={s.title}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕</Text>
          </Pressable>
        </View>
        {items.map((item) =>
          item.hold ? (
            <HoldButton key={item.label} label={item.label} onComplete={() => { onClose(); item.onPress(); }} />
          ) : (
            <Pressable key={item.label} accessibilityRole="button" onPress={() => { onClose(); item.onPress(); }} style={s.row}>
              <Text style={s.rowText}>{item.label}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'absolute', top: 0, left: 0, right: 0, maxWidth: 480, backgroundColor: colors.card,
    borderBottomRightRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: typeFamily.title, fontFamily: fonts.display, color: colors.ink },
  closeBtn: { minWidth: TARGET, minHeight: TARGET, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 24, color: colors.inkSoft },
  row: { minHeight: TARGET, justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8 },
  rowText: { fontSize: typeFamily.body, fontWeight: '700', color: colors.ink },
});
