import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Pin, Profile } from '../types';
import { distanceMeters, formatDistance, formatMeetAt, pinQuotaLabel } from '../utils';

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
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Yakındaki marklar"
        onPress={() => setOpen((v) => !v)}
        style={styles.header}
      >
        <Text style={styles.title}>Yakında · {rows.length} açık mark</Text>
        <Text style={styles.chev}>{open ? '▾' : '▴'}</Text>
      </Pressable>
      {open ? (
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
                    {mine ? 'Sen' : pin.anonymous ? 'Anonim' : author?.name || 'Biri'}
                    {pin.kind !== 'chat' && pin.placeName ? ` · ${pin.placeName}` : ''}
                  </Text>
                  <Text style={styles.text} numberOfLines={1}>
                    {pin.text}
                  </Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.dist}>{formatDistance(meters)}</Text>
                  <Text style={styles.time}>
                    {pin.kind === 'chat' ? 'Sohbet' : formatMeetAt(pin.meetAt)}
                  </Text>
                  {pin.capacity ? (
                    <Text style={styles.time}>{pinQuotaLabel(pin)}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 72,
      maxHeight: 168,
      backgroundColor: colors.paper,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
      shadowColor: colors.ink,
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    title: {
      flex: 1,
      fontWeight: '800',
      color: colors.ink,
      fontSize: 13,
    },
    chev: { color: colors.muted, fontWeight: '800', fontSize: 14 },
    scroller: { maxHeight: 120 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    name: { fontWeight: '800', color: colors.ink, fontSize: 12 },
    text: { color: colors.muted, fontSize: 11, marginTop: 1 },
    metaCol: { alignItems: 'flex-end' },
    dist: { color: colors.teal, fontWeight: '800', fontSize: 11 },
    time: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 1 },
  });
