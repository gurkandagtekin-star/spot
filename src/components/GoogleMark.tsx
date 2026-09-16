import { StyleSheet, View } from 'react-native';

/** Compact 4-color G, not a Google login page. */
export function GoogleMark() {
  return (
    <View style={styles.box}>
      <View style={[styles.arm, styles.blue]} />
      <View style={[styles.arm, styles.red]} />
      <View style={[styles.arm, styles.yellow]} />
      <View style={[styles.arm, styles.green]} />
      <View style={styles.hole} />
      <View style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#fff',
  },
  arm: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
  blue: { backgroundColor: '#4285F4', right: 0, top: 0 },
  red: { backgroundColor: '#EA4335', left: 0, top: 0 },
  yellow: { backgroundColor: '#FBBC05', left: 0, bottom: 0 },
  green: { backgroundColor: '#34A853', right: 0, bottom: 0 },
  hole: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    top: 6,
    left: 6,
  },
  bar: {
    position: 'absolute',
    height: 4,
    width: 8,
    backgroundColor: '#4285F4',
    right: 1,
    top: 8,
    borderRadius: 1,
  },
});
