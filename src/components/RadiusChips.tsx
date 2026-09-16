import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { PIN_RANGE_OPTIONS, type PinRange } from '../utils';

export function RadiusChips({
  value,
  onChange,
}: {
  value: PinRange;
  onChange: (next: PinRange) => void;
}) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {PIN_RANGE_OPTIONS.map((opt) => {
          const on = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Görünür mesafe ${opt.label}`}
              onPress={() => onChange(opt.id)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.text, on && styles.textOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 108,
    left: 16,
    right: 88,
  },
  row: { gap: 6, paddingRight: 4 },
  chip: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  text: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  textOn: { color: '#fff' },
});
