import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function Avatar({
  name,
  uri,
  size = 44,
}: {
  name: string;
  uri?: string;
  size?: number;
}) {
  const letter = (name || '?').trim().slice(0, 1).toUpperCase();
  const round = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
  if (uri) {
    return <Image source={{ uri }} style={[styles.img, round]} />;
  }
  return (
    <View style={[styles.wrap, round]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { backgroundColor: colors.coralSoft },
  letter: { fontWeight: '800', color: colors.coral },
});
