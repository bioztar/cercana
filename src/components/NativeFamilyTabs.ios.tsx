import React, { useMemo } from 'react';
import { View } from 'react-native';
import TabView, { type AppleIcon } from 'react-native-bottom-tabs';
import type { AppTab } from './FamilyTabBar';
import { colors } from '../theme';

// SF Symbols for the iOS tab bar (UITabBar via react-native-bottom-tabs; Liquid Glass on iOS 26+).
const SYMBOL: Record<AppTab, AppleIcon['sfSymbol']> = {
  Today: 'sun.max',
  Feed: 'text.bubble',
  Calendar: 'calendar',
  People: 'person.2',
  Settings: 'gearshape',
  Chats: 'bubble.left.and.bubble.right',
};

type Props<T extends AppTab> = {
  tabs: readonly T[]; active: T; onSelect: (tab: T) => void; large?: boolean; children: React.ReactNode;
};

/** iOS: the native tab bar around the current route. Only the active tab renders `children`, because
 * routing stays in App.tsx state (no Expo Router here); the others are empty scenes. `large` has no
 * effect: the system bar keeps the user's Dynamic Type size. */
export function NativeFamilyTabs<T extends AppTab>({ tabs, active, onSelect, children }: Props<T>) {
  const routes = useMemo(() => tabs.map((t) => ({ key: t, title: t, focusedIcon: { sfSymbol: SYMBOL[t] } })), [tabs]);
  return (
    <TabView
      navigationState={{ index: tabs.indexOf(active), routes }}
      onIndexChange={(i) => onSelect(tabs[i])}
      renderScene={({ route }) => (route.key === active ? <View style={{ flex: 1 }}>{children}</View> : null)}
      labeled
      hapticFeedbackEnabled
      tabBarActiveTintColor={colors.terracotta}
    />
  );
}
