import React from 'react';
import { Image, View, type ImageProps } from 'react-native';
import { useMediaUrl } from '../lib/mediaUrl';
import { colors } from '../theme';

type Props = Omit<ImageProps, 'source'> & { path: string };

/** `<Image>` for a stored media path: shows a quiet placeholder until the signed URL is ready. */
export function MediaImage({ path, style, ...rest }: Props) {
  const uri = useMediaUrl(path);
  if (!uri) return <View accessibilityLabel={rest.accessibilityLabel} style={[style, { backgroundColor: colors.line }]} />;
  return <Image {...rest} style={style} source={{ uri }} />;
}
