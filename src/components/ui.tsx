import React from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { colors, TARGET, type } from '../theme';

type BtnProps = {
  label: string;
  onPress: () => void;
  tone?: 'green' | 'terracotta' | 'plain' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
};

export function BigButton({ label, onPress, tone = 'green', disabled, busy, style }: BtnProps) {
  const bg = { green: colors.green, terracotta: colors.terracotta, danger: colors.danger, plain: colors.card }[tone];
  const fg = tone === 'plain' ? colors.ink : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        tone === 'plain' && { borderWidth: 2, borderColor: colors.ink },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Avatar({ uri, name, size }: { uri?: string | null; name: string; size: number }) {
  const box = { width: size, height: size, borderRadius: size / 8 };
  if (uri) return <Image accessibilityLabel={name} source={{ uri }} style={[box, { backgroundColor: colors.line }]} />;
  return (
    <View style={[box, s.avatarFallback]}>
      <Text style={{ fontSize: size / 2.5, fontWeight: '700', color: colors.inkSoft }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

export function Field({ label, ...rest }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8A7862"
        {...rest}
        style={[s.input, rest.multiline && { minHeight: 96, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <Text style={s.error}>{message}</Text> : null;
}

const s = StyleSheet.create({
  btn: {
    minHeight: TARGET,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: type.body, fontWeight: '700', textAlign: 'center' },
  avatarFallback: { backgroundColor: colors.warm, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 18, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  input: {
    minHeight: 52,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 20,
    color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 18, fontWeight: '600', marginVertical: 8 },
});
