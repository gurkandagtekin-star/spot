import { useEffect, useRef, useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFormattedImageUrl } from '../api';
import { Avatar } from './Avatar';

type Props = {
  uris: string[];
  height: number;
  name?: string;
  topInset?: number;
  onLongPress?: () => void;
  onIndexChange?: (index: number) => void;
};

export function PhotoCarousel({
  uris,
  height,
  name,
  topInset = 0,
  onLongPress,
  onIndexChange,
}: Props) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const n = Math.max(uris.length, 1);
  const i = Math.min(index, n - 1);

  useEffect(() => {
    onIndexChange?.(i);
  }, [i, onIndexChange]);

  useEffect(() => {
    setIndex(0);
    scroller.current?.scrollTo({ x: 0, animated: false });
  }, [uris.length, uris[0]]);

  const go = (next: number) => {
    if (n < 2 || width <= 0) return;
    const clamped = (next + n) % n;
    setIndex(clamped);
    scroller.current?.scrollTo({ x: clamped * width, animated: true });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.min(n - 1, Math.max(0, next)));
  };

  return (
    <View
      style={[styles.box, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {uris.length ? (
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          scrollEnabled={n > 1}
          style={styles.media}
        >
          {uris.map((raw, k) => {
            const uri = getFormattedImageUrl(raw) || raw;
            return (
              <Pressable
                key={`${uri}-${k}`}
                onPress={(e) => {
                  if (n < 2) {
                    onLongPress?.();
                    return;
                  }
                  const x = e.nativeEvent.locationX;
                  go(x < width / 2 ? i - 1 : i + 1);
                }}
                onLongPress={onLongPress}
              >
                <Image
                  source={{ uri }}
                  style={{ width: width || 1, height }}
                  resizeMode="cover"
                />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : name ? (
        <View style={styles.fallback}>
          <Avatar name={name} size={Math.round(height * 0.38)} />
        </View>
      ) : (
        <LinearGradient
          colors={['#12081C', '#3A1840', '#C73B7A', '#FF7A9C']}
          locations={[0, 0.38, 0.72, 1]}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={['rgba(10,6,16,0.42)', 'transparent', 'rgba(10,6,16,0.22)']}
        locations={[0, 0.28, 1]}
        style={styles.shade}
        pointerEvents="none"
      />
      <View style={[styles.bars, { top: topInset + 8 }]} pointerEvents="none">
        {Array.from({ length: n }).map((_, k) => (
          <View key={k} style={[styles.bar, k === i && styles.barOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    backgroundColor: '#12081C',
    overflow: 'hidden',
  },
  media: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A1840',
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  bars: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 5,
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  barOn: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
