import React, { createContext, useContext } from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fonts } from '../theme';

/** True once the Fraunces / Atkinson files are loaded; until then text uses the system font. */
export const FontsReady = createContext(false);

/** Picks the mockup font family from the style's fontWeight; an explicit fontFamily wins. */
export function fontStyle(style: TextStyle, ready: boolean): TextStyle {
  const { fontWeight, fontFamily, ...rest } = style;
  if (!ready) return style;
  if (fontFamily) return { ...rest, fontFamily };
  const bold = fontWeight === 'bold' || (fontWeight !== undefined && Number(fontWeight) >= 600);
  return { ...rest, fontFamily: bold ? fonts.bodyBold : fonts.body };
}

export function Text({ style, ...rest }: TextProps) {
  const ready = useContext(FontsReady);
  return <RNText {...rest} style={fontStyle(StyleSheet.flatten(style) ?? {}, ready)} />;
}
