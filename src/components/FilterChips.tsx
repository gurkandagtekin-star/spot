import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

export type FilterChipOption<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (next: T) => void;
  scroll?: boolean;
  wrap?: boolean;
};

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  wrap,
  styles,
}: Props<T> & { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={[styles.row, wrap && styles.wrapRow]}>
      {options.map((opt) => {
        const on = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FilterChips<T extends string>(props: Props<T>) {
  const styles = useThemedStyles(createStyles);
  if (props.scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <ChipRow {...props} wrap={false} styles={styles} />
      </ScrollView>
    );
  }
  return <ChipRow {...props} styles={styles} />;
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    scroll: { paddingRight: 4 },
    row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    wrapRow: { flexWrap: 'wrap' },
    chip: {
      backgroundColor: colors.chipBg,
      borderWidth: 1.5,
      borderColor: colors.chipBg,
      borderRadius: radius.pill,
      paddingHorizontal: 13,
      paddingVertical: 8,
    },
    chipOn: {
      backgroundColor: colors.chipOnBg,
      borderColor: '#FFFFFF',
    },
    text: {
      color: colors.chipText,
      fontWeight: '800',
      fontSize: 13,
    },
    textOn: {
      color: colors.chipOnText,
      fontWeight: '900',
    },
  });
