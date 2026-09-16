import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { Pin, Profile } from '../types';
import { distanceMeters, formatDistance, formatMeetAt } from '../utils';

type Row = {
  pin: Pin;
  meters: number;
  author?: Profile;
};

type Props = {
  pins: Pin[];
  meId: string;
  origin: { lat: number; lng: number };
  profileById: (id: string) => Profile | undefined;
  onOpen: (pinId: string) => void;
};

export function NearbyList({ pins, meId, origin, profileById, onOpen }: Props) {
  const rows: Row[] = [...pins]
    .map((pin) => ({
      pin,
      meters: distanceMeters(origin, pin),
      author: profileById(pin.authorId),
    }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 8);

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Yakında · {rows.length} açık mark</Text>
      <ScrollView
        style={styles.scroller}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {rows.map(({ pin, meters, author }) => {
          const mine = pin.authorId === meId;
          return (
            <Pressable
              key={pin.id}
              accessibilityRole="button"
              accessibilityLabel={pin.text}
              style={styles.row}
              onPress={() => onOpen(pin.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {mine ? 'Sen' : author?.name || 'Biri'}
                  {pin.placeName ? ` · ${pin.placeName}` : ''}
                </Text>
                <Text style={styles.text} numberOfLines={1}>
                  {pin.text}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.dist}>{formatDistance(meters)}</Text>
                <Text style={styles.time}>{formatMeetAt(pin.meetAt)}</Text>
              </View>
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
    left: 16,
    right: 16,
    bottom: 88,
    maxHeight: 210,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingTop: 10,
    paddingBottom: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  title: {
    fontWeight: '800',
    color: colors.ink,
    fontSize: 13,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  scroller: { maxHeight: 168 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  name: { fontWeight: '800', color: colors.ink, fontSize: 13 },
  text: { color: colors.muted, fontSize: 12, marginTop: 2 },
  metaCol: { alignItems: 'flex-end' },
  dist: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  time: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
});
