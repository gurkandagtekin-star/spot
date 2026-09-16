import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const TILE = 'https://tile.openstreetmap.org/15/19026/12286.png';
const TILE_R = 'https://tile.openstreetmap.org/15/19027/12286.png';
const TILE_B = 'https://tile.openstreetmap.org/15/19026/12287.png';
const TILE_BR = 'https://tile.openstreetmap.org/15/19027/12287.png';

export function SignupMapPreview() {
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden>
      <View style={styles.grid}>
        <Image source={{ uri: TILE }} style={styles.tile} />
        <Image source={{ uri: TILE_R }} style={styles.tile} />
        <Image source={{ uri: TILE_B }} style={styles.tile} />
        <Image source={{ uri: TILE_BR }} style={styles.tile} />
      </View>
      <View style={styles.scrim} />

      <View style={[styles.bubble, styles.b1]}>
        <View style={styles.ava}>
          <Text style={styles.avaT}>E</Text>
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.txt} numberOfLines={1}>
            Kahve içelim
          </Text>
          <Text style={styles.meta}>18:30 · Kadıköy</Text>
        </View>
      </View>

      <View style={[styles.bubble, styles.b2, styles.activity]}>
        <View style={[styles.ava, styles.avaTeal]}>
          <Text style={[styles.avaT, { color: colors.teal }]}>N</Text>
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.txt} numberOfLines={1}>
            Sahilde yürüyüş
          </Text>
          <Text style={styles.meta}>19:00 · Moda</Text>
        </View>
      </View>

      <View style={styles.you} />
      <View style={styles.draft} />

      <View style={styles.bar}>
        <Text style={styles.barHint}>Haritaya dokun, mark bırak</Text>
        <View style={styles.barBtn}>
          <Text style={styles.barBtnT}>Mark koy</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 292,
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E8DFD2',
    borderWidth: 1,
    borderColor: colors.line,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: { width: '50%', height: '50%' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(246,240,230,0.12)',
  },
  bubble: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.paper,
    borderRadius: 22,
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 6,
    maxWidth: 188,
    borderWidth: 1,
    borderColor: colors.coral,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  activity: { borderColor: colors.teal },
  b1: { top: 54, left: 14 },
  b2: { top: 118, right: 14 },
  ava: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaTeal: { backgroundColor: colors.tealSoft },
  avaT: { color: colors.coral, fontWeight: '800', fontSize: 14 },
  txt: { fontWeight: '700', color: colors.ink, fontSize: 12.5 },
  meta: { color: colors.muted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  you: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.teal,
    borderWidth: 3,
    borderColor: '#fff',
    bottom: 92,
    left: '46%',
    shadowColor: colors.teal,
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  draft: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.coral,
    borderWidth: 3,
    borderColor: '#fff',
    bottom: 118,
    right: '38%',
    transform: [{ rotate: '-45deg' }],
  },
  bar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barHint: { flex: 1, color: colors.muted, fontWeight: '700', fontSize: 12 },
  barBtn: {
    backgroundColor: colors.coral,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  barBtnT: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
