import { useEffect, useRef, useState, createElement } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';

const packed = require('../../assets/arkaplan.mp4');

function WebLoopVideo({ uri }: { uri: string }) {
  return createElement('video', {
    src: uri,
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    controls: false,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
  });
}

function NativeGlow() {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 9000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const shift = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 48],
  });
  const spin = drift.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '28deg'],
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.blob,
          { transform: [{ translateX: shift }, { translateY: shift }, { rotate: spin }] },
        ]}
      >
        <LinearGradient
          colors={['#1A0A12', '#FF5E97', '#3A1528', '#0A0A0A']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={['rgba(10,10,10,0.35)', 'rgba(10,10,10,0.82)']}
        style={styles.dim}
      />
    </View>
  );
}

export function SignupBackground() {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let live = true;
    const asset = Asset.fromModule(packed);
    void asset.downloadAsync().then(() => {
      if (live) setUri(asset.localUri || asset.uri);
    });
    return () => {
      live = false;
    };
  }, []);

  if (Platform.OS !== 'web') return <NativeGlow />;

  return (
    <View style={styles.wrap} pointerEvents="none">
      {uri ? <WebLoopVideo uri={uri} /> : <NativeGlow />}
      <View style={styles.webDim} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: '140%',
    height: '140%',
    left: '-20%',
    top: '-18%',
    opacity: 0.55,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
  },
  webDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
});
