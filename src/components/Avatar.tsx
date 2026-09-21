import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getFormattedImageUrl } from '../api';
import type { ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

export function Avatar({
  name,
  uri,
  size = 44,
}: {
  name: string;
  uri?: string;
  size?: number;
}) {
  const styles = useThemedStyles(createStyles);
  const [broken, setBroken] = useState(false);
  const letter = (name || '?').trim().slice(0, 1).toUpperCase();
  const src = getFormattedImageUrl(uri) || '';
  const round = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (src && !broken) {
    return (
      <Image
        source={{ uri: src }}
        style={[styles.img, round]}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <View style={[styles.wrap, round]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: '#5B2A6B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    img: { backgroundColor: colors.coralSoft },
    letter: { fontWeight: '800', color: '#F4C6FF' },
  });
