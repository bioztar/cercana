import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, type } from '../theme';

export function MissingConfig({ names }: { names: string[] }) {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.title}>Cercana is not set up yet</Text>
      <Text style={s.body}>
        {names.length === 1 ? 'This setting is missing:' : 'These settings are missing:'}
      </Text>
      {names.map((n) => (
        <Text key={n} style={s.name} selectable>
          {n}
        </Text>
      ))}
      <Text style={s.body}>
        Copy .env.example to .env, fill them in, and restart the app. For the web build, pass them as build
        arguments.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink },
  body: { fontSize: type.body, color: colors.ink, lineHeight: 32 },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.terracotta,
    backgroundColor: colors.warm,
    padding: 14,
    borderRadius: 12,
  },
});
