import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Thin strip at the very top so nobody mistakes sample data for a real family. It sits in the
 * layout flow (not floating), so it reserves its own space and never covers content.
 */
export function DemoRibbon() {
  return (
    <View style={s.bar} accessibilityLabel="Demo, sample family">
      <Text style={s.text}>Demo — sample family</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: colors.terracotta, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  text: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
