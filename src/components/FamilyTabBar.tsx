import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors } from '../theme';

export const FAMILY_TABS = ['Today', 'Feed', 'Calendar', 'People', 'Chats', 'Settings'] as const;
export type FamilyTab = (typeof FAMILY_TABS)[number];
/** Andrey's original tab bar (Vitaly, 2026-09-24 15:50); "Tell family" became a floating "+" (15:55) —
 * Settings stays behind the press-and-hold button on Feed, not a tab. */
export const PATIENT_TABS = ['Feed', 'People', 'Calendar', 'Chats'] as const;
export type PatientTab = (typeof PATIENT_TABS)[number];
export type AppTab = FamilyTab | PatientTab;

type Props<T extends AppTab> = { tabs: readonly T[]; active: T | null; onSelect: (tab: T) => void; large?: boolean };

/** Web / Android bar (iOS draws the native UITabBar, see NativeFamilyTabs.ios.tsx). On every route, so no
 * screen is a dead end (Andrey, 2026-09-24). */
export function FamilyTabBar<T extends AppTab>({ tabs, active, onSelect, large }: Props<T>) {
  return (
    <View style={s.bar} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t === active;
        return (
          <Pressable key={t} onPress={() => onSelect(t)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[s.tab, large && s.tabLarge]}>
            <View style={[s.pill, on && s.pillOn]}>
              <Text style={[s.label, large && s.labelLarge, on && s.labelOn]} numberOfLines={1}>{t}</Text>
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
  tabLarge: { minHeight: 64 },
  pill: { paddingHorizontal: 6, paddingVertical: 8, borderRadius: 12, minWidth: 0 },
  pillOn: { backgroundColor: colors.peachSoft },
  label: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  labelLarge: { fontSize: 20 },
  labelOn: { color: colors.terracotta },
});
