import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { BadgeRow } from '../components/BadgeRow';
import { pickProfilePhoto } from '../media/pickPhoto';
import { useSpot } from '../store/SpotContext';
import { colors, radius } from '../theme';
import { BADGE_META } from '../data/play';
import { FREE_DAILY_PINS } from '../utils';

export function ProfileScreen({ onOpenPro }: { onOpenPro: () => void }) {
  const spot = useSpot();
  const [name, setName] = useState(spot.me.name);
  const [bio, setBio] = useState(spot.me.bio);
  const [handle, setHandle] = useState(spot.me.instagram || '');
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.heroRow}>
        <Pressable
          onPress={async () => {
            try {
              const picked = await pickProfilePhoto();
              if (!picked) return;
              await spot.uploadPhoto(picked.dataUrl);
            } catch {
              /* ignore */
            }
          }}
        >
          <Avatar name={spot.me.name} uri={spot.me.photoUrl} size={64} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Profil</Text>
          <Text style={styles.lead}>Fotoğrafa bas, galeriden değiştir.</Text>
          <BadgeRow badges={spot.me.badges} socialLeader={spot.me.socialLeader} />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Ad</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} />
        <Text style={styles.label}>Instagram köprüsü</Text>
        <View style={styles.handleRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            value={handle}
            onChangeText={(v) => setHandle(v.replace(/^@/, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="kullaniciadi  ·  isteğe bağlı"
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
          />
        </View>
        <Text style={styles.meta}>
          Zorunlu değil. Kartta Instagram’a gider. Meta doğrulaması yok.
        </Text>
        <Text style={styles.label}>Kısa tanıtım</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
        />
        {formError ? <Text style={styles.meta}>{formError}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kaydet"
          style={styles.cta}
          onPress={async () => {
            try {
              setFormError(null);
              await spot.setMyProfile({
                name: name.trim() || spot.me.name,
                bio: bio.trim() || spot.me.bio,
                instagram: handle.trim(),
              });
              setSaved(true);
              setTimeout(() => setSaved(false), 1600);
            } catch (err) {
              setFormError(
                err instanceof Error ? err.message : 'Kaydedilemedi.',
              );
            }
          }}
        >
          <Text style={styles.ctaText}>{saved ? 'Kaydedildi' : 'Kaydet'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Çıkış yap"
          style={styles.ghost}
          onPress={() => {
            void spot.signOut();
          }}
        >
          <Text style={styles.ghostText}>Çıkış yap</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.stat}>Gizlilik</Text>
        <Text style={styles.meta}>
          Konumun yalnızca açık mark’ını haritada göstermek için kullanılır. Sohbet
          çift onaydan sonra açılır. Instagram kullanıcı adın isteğe bağlı bir köprüdür;
          Meta hesabını saklamayız.
        </Text>
        <Text style={styles.meta}>
          Hesabını silersen mark’ların, sohbetlerin ve profilin bu cihazdan ve
          sunucudan kalkar. Geri alınmaz.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hesabı sil"
          style={styles.danger}
          onPress={() => {
            Alert.alert(
              'Hesabı sil',
              'Mark’ların, sohbetlerin ve profilin silinir. Bu işlem geri alınmaz.',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Hesabı sil',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      const res = await spot.deleteAccount();
                      if (!res.ok) {
                        Alert.alert('Silinemedi', res.reason);
                      }
                    })();
                  },
                },
              ],
            );
          }}
        >
          <Text style={styles.dangerText}>Hesabı sil</Text>
        </Pressable>
      </View>
      {(spot.me.badges?.length || spot.me.socialLeader) ? (
        <View style={styles.card}>
          <Text style={styles.stat}>Rozetlerin</Text>
          {spot.me.socialLeader ? (
            <Text style={styles.meta}>
              👑 Bu hafta en çok insanı bir araya getirenlerden. Haritada taç görünür.
            </Text>
          ) : null}
          {(spot.me.badges || []).map((id) => (
            <Text key={id} style={styles.meta}>
              {BADGE_META[id]?.title || id}: {BADGE_META[id]?.text || ''}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.stat}>
          {spot.me.isPro
            ? 'Pro · sınırsız mark'
            : `Bugün kalan hak: ${spot.remainingPins}/${FREE_DAILY_PINS}`}
        </Text>
        <Text style={styles.meta}>
          {spot.me.email ? `Google: ${spot.me.email}` : 'Google bağlı'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark Date Pro"
          style={spot.me.isPro ? styles.ghost : styles.proBtn}
          onPress={onOpenPro}
        >
          <Text style={spot.me.isPro ? styles.ghostText : styles.proText}>
            {spot.me.isPro ? 'Pro özellikler' : 'Pro’ya geç'}
          </Text>
        </Pressable>
      </View>
      {spot.live.some((p) => p.authorId === spot.meId) ? (
        <View style={styles.card}>
          <Text style={styles.stat}>Açık mark’ların</Text>
          {spot.live
            .filter((p) => p.authorId === spot.meId)
            .map((pin) => (
              <View key={pin.id} style={styles.markRow}>
                <Text style={[styles.meta, { flex: 1 }]} numberOfLines={2}>
                  {pin.text}
                </Text>
                <Pressable onPress={() => void spot.closePin(pin.id)}>
                  <Text style={styles.closeMark}>Markı Sil</Text>
                </Pressable>
              </View>
            ))}
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.stat}>Engellenenler</Text>
        <Text style={styles.meta}>
          Engeli kaldırırsan mark’ları tekrar görünür. Eski sohbet açılmaz.
        </Text>
        {(spot.blocked || []).length === 0 ? (
          <Text style={styles.meta}>Kimseyi engellemedin.</Text>
        ) : (
          (spot.blocked || []).map((person) => (
            <View key={person.id} style={styles.blockRow}>
              <Avatar name={person.name} uri={person.photoUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.blockName}>{person.name}</Text>
                {person.instagram ? (
                  <Text style={styles.meta}>@{person.instagram}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${person.name} engelini kaldır`}
                onPress={() => void spot.unblockUser(person.id)}
              >
                <Text style={styles.unblock}>Kaldır</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: colors.ink },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 4 },
  lead: { color: colors.muted, lineHeight: 20 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8,
  },
  label: { fontWeight: '700', color: colors.ink, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 12,
    color: colors.ink,
    backgroundColor: colors.paperSoft,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingLeft: 12,
    backgroundColor: colors.paperSoft,
  },
  at: { fontWeight: '800', color: colors.muted, fontSize: 16 },
  verified: { color: colors.teal, fontWeight: '800', paddingVertical: 6 },
  cta: {
    marginTop: 8,
    backgroundColor: colors.coral,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800' },
  ghost: {
    marginTop: 4,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  ghostText: { color: colors.muted, fontWeight: '700' },
  danger: {
    marginTop: 8,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  dangerText: { color: colors.warning, fontWeight: '800' },
  proBtn: {
    marginTop: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  proText: { color: '#fff', fontWeight: '800' },
  stat: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, lineHeight: 20 },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  closeMark: { color: colors.warning, fontWeight: '800' },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  blockName: { fontWeight: '800', color: colors.ink },
  unblock: { color: colors.teal, fontWeight: '800' },
});
