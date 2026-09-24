import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/** Small, non-interactive pill so nobody mistakes sample data for a real family. */
export function DemoRibbon() {
  return (
    <View pointerEvents="none" style={s.pill} accessibilityLabel="Demo, sample family">
      <Text style={s.text}>Demo — sample family</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    position: 'absolute', left: 8, bottom: 8, zIndex: 200, backgroundColor: colors.terracotta,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, opacity: 0.92,
  },
  text: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
