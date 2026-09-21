import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type PinRange } from '../utils';

const PINK = '#FF5E97';

const OPTIONS: {
  id: PinRange;
  title: string;
  unit?: string;
  icon?: 'pin' | 'all';
}[] = [
  { id: '1', title: '1', unit: 'km' },
  { id: '3', title: '3', unit: 'km' },
  { id: '5', title: '5', unit: 'km' },
  { id: '15', title: '15', unit: 'km' },
  { id: 'area', title: 'Semt', icon: 'pin' },
  { id: 'all', title: 'Tümü', icon: 'all' },
];

export function RadiusChips({
  value,
  onChange,
  locked,
}: {
  value: PinRange;
  onChange: (next: PinRange) => void;
  locked?: PinRange[];
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
      style={styles.scroller}
    >
      {OPTIONS.map((opt) => {
        const on = opt.id === value;
        const isLocked = Boolean(locked?.includes(opt.id));
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: false }}
            accessibilityLabel={`Görünür mesafe ${opt.unit ? `${opt.title} ${opt.unit}` : opt.title}${isLocked ? ' · Pro' : ''}`}
            onPress={() => onChange(opt.id)}
            style={[styles.pill, on && styles.pillOn, isLocked && !on && styles.pillLocked]}
          >
            {opt.icon === 'pin' ? <PinGlyph on={on} /> : null}
            {opt.icon === 'all' ? <AllGlyph on={on} /> : null}
            <Text style={[styles.title, on && styles.titleOn]}>{opt.title}</Text>
            {opt.unit ? (
              <Text style={[styles.unit, on && styles.unitOn]}>{opt.unit}</Text>
            ) : isLocked ? (
              <Text style={[styles.unit, on && styles.unitOn]}>Pro</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PinGlyph({ on }: { on: boolean }) {
  const color = on ? '#FFFFFF' : 'rgba(236, 228, 245, 0.78)';
  return (
    <View style={styles.glyph}>
      <View style={[styles.pinHead, { borderColor: color }]} />
      <View style={[styles.pinTip, { borderTopColor: color }]} />
    </View>
  );
}

function AllGlyph({ on }: { on: boolean }) {
  const color = on ? '#FFFFFF' : 'rgba(236, 228, 245, 0.78)';
  return (
    <View style={[styles.glyph, styles.rings]}>
      <View style={[styles.ring, { borderColor: color }]} />
      <View style={[styles.ringDot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroller: { marginHorizontal: -4 },
  track: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(28, 18, 52, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pillOn: {
    backgroundColor: PINK,
    borderColor: PINK,
    shadowColor: PINK,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  pillLocked: { opacity: 0.72 },
  title: {
    color: 'rgba(245, 238, 250, 0.88)',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  titleOn: { color: '#FFFFFF' },
  unit: {
    color: 'rgba(214, 204, 228, 0.72)',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  unitOn: { color: 'rgba(255, 255, 255, 0.92)' },
  glyph: {
    width: 11,
    height: 13,
    marginRight: 2,
    alignItems: 'center',
    alignSelf: 'center',
  },
  pinHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.6,
  },
  pinTip: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  rings: { justifyContent: 'center' },
  ring: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.4,
  },
  ringDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
  },
});
