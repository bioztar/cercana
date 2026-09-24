import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors } from '../theme';

export const FAMILY_TABS = ['Today', 'Feed', 'Calendar', 'People', 'Settings'] as const;
export type FamilyTab = (typeof FAMILY_TABS)[number];

type Props = { active: FamilyTab | null; onSelect: (tab: FamilyTab) => void };

/** Family side: always on screen, on every route, so no screen is a dead end (Andrey, 2026-09-24). */
export function FamilyTabBar({ active, onSelect }: Props) {
  return (
    <View style={s.bar} accessibilityRole="tablist">
      {FAMILY_TABS.map((t) => {
        const on = t === active;
        return (
          <Pressable key={t} onPress={() => onSelect(t)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={s.tab}>
            <View style={[s.pill, on && s.pillOn]}>
              <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{t}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line,
    paddingHorizontal: 4, paddingTop: 6, paddingBottom: 6,
  },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 6, paddingVertical: 8, borderRadius: 12, minWidth: 0 },
  pillOn: { backgroundColor: colors.peachSoft },
  label: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  labelOn: { color: colors.terracotta },
});
