import { useEffect, useRef, type RefObject } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

const ITEM = 40;
const VISIBLE = 3;
const PAD = ITEM;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS = Array.from({ length: 12 }, (_, i) => i * 5);

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function snapIndex(y: number, count: number) {
  const i = Math.round(y / ITEM);
  return Math.max(0, Math.min(count - 1, i));
}

type Props = {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
};

export function TimeWheel({ hour, minute, onChange }: Props) {
  const styles = useThemedStyles(createStyles);
  const hourRef = useRef<ScrollView>(null);
  const minRef = useRef<ScrollView>(null);
  const hourVal = useRef(hour);
  const minVal = useRef(minute);
  hourVal.current = hour;
  minVal.current = minute;

  useEffect(() => {
    const h = Math.max(0, Math.min(23, hour));
    const m = Math.round(minute / 5) * 5;
    const mi = MINS.indexOf(m === 60 ? 0 : m);
    requestAnimationFrame(() => {
      hourRef.current?.scrollTo({ y: h * ITEM, animated: false });
      minRef.current?.scrollTo({ y: Math.max(0, mi) * ITEM, animated: false });
    });
  }, []);

  const onHour = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = snapIndex(e.nativeEvent.contentOffset.y, HOURS.length);
    if (HOURS[i] !== hourVal.current) onChange(HOURS[i], minVal.current);
  };
  const onMin = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = snapIndex(e.nativeEvent.contentOffset.y, MINS.length);
    if (MINS[i] !== minVal.current) onChange(hourVal.current, MINS[i]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.highlight} pointerEvents="none" />
      <Wheel
        scrollRef={hourRef}
        values={HOURS}
        format={pad}
        styles={styles}
        onEnd={onHour}
      />
      <Text style={styles.colon}>:</Text>
      <Wheel
        scrollRef={minRef}
        values={MINS}
        format={pad}
        styles={styles}
        onEnd={onMin}
      />
    </View>
  );
}

function Wheel({
  scrollRef,
  values,
  format,
  styles,
  onEnd,
}: {
  scrollRef: RefObject<ScrollView | null>;
  values: number[];
  format: (n: number) => string;
  styles: ReturnType<typeof createStyles>;
  onEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  return (
    <ScrollView
      ref={scrollRef}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      onMomentumScrollEnd={onEnd}
      onScrollEndDrag={onEnd}
      contentContainerStyle={{ paddingVertical: PAD }}
      style={styles.col}
    >
      {values.map((n) => (
        <View key={n} style={styles.item}>
          <Text style={styles.num}>{format(n)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrap: {
      height: ITEM * VISIBLE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    highlight: {
      position: 'absolute',
      left: 12,
      right: 12,
      height: ITEM,
      borderRadius: 12,
      backgroundColor: colors.chipOnBg,
      opacity: 0.18,
    },
    col: { height: ITEM * VISIBLE, width: 72 },
    colon: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.ink,
      marginHorizontal: 4,
    },
    item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
    num: { fontSize: 22, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  });
