import React from 'react';
import { View } from 'react-native';
import { FamilyTabBar, type AppTab } from './FamilyTabBar';

type Props<T extends AppTab> = {
  tabs: readonly T[]; active: T; onSelect: (tab: T) => void; large?: boolean; children: React.ReactNode;
};

/** Web / Android: the drawn tab bar. iOS uses the native UITabBar (NativeFamilyTabs.ios.tsx), so the
 * native module never enters the web bundle. */
export function NativeFamilyTabs<T extends AppTab>({ tabs, active, onSelect, large, children }: Props<T>) {
  return (
    <>
      <View style={{ flex: 1 }}>{children}</View>
      <FamilyTabBar tabs={tabs} active={active} onSelect={onSelect} large={large} />
    </>
  );
}
