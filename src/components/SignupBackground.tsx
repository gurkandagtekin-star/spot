import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';

const assetId = require('../../assets/arkaplan.mp4');

export function SignupBackground({ children }: { children: ReactNode }) {
  const player = useVideoPlayer({ assetId }, (next) => {
    next.loop = true;
    next.muted = true;
    next.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.play();
  }, [player]);

  return (
    <View style={styles.fill}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        playsInline
        {...(Platform.OS === 'android' ? { surfaceType: 'textureView' as const } : {})}
      />
      <LinearGradient
        colors={['rgba(18, 8, 28, 0.22)', 'rgba(18, 8, 28, 0.48)']}
        pointerEvents="none"
        style={styles.dim}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#12081C' },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
  },
  content: { flex: 1 },
});
