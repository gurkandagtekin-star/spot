import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api';
import { DragSheet } from './DragSheet';
import { Avatar } from './Avatar';
import { useSpot } from '../store/SpotContext';
import { displayName, usernameOf } from '../utils';
import type { FollowListUser, Profile } from '../types';
import type { ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';

type Kind = 'followers' | 'following';

function asCard(p: Profile): FollowListUser {
  const name = displayName(p) || p.displayName || p.name || '';
  return {
    id: p.id,
    name,
    firstName: p.firstName,
    lastName: p.lastName,
    username: p.username || '',
    displayName: p.displayName || name,
    photoUrl: p.photoUrl || p.avatarUrl || '',
    avatarUrl: p.avatarUrl || p.photoUrl || '',
  };
}

function asProfile(u: FollowListUser): Profile {
  const name = displayName(u) || u.displayName || u.name || '';
  return {
    id: u.id,
    name,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username || '',
    displayName: u.displayName || name,
    photoUrl: u.photoUrl || u.avatarUrl || '',
    avatarUrl: u.avatarUrl || u.photoUrl || '',
    bio: '',
    interests: [],
  };
}

function localFollowList(
  people: Profile[],
  meId: string,
  ownerId: string,
  kind: Kind,
): FollowListUser[] {
  const pool = people.filter((p) => p?.id);
  const byId = new Map(pool.map((p) => [p.id, p]));
  if (kind === 'following') {
    const owner = byId.get(ownerId);
    const ids = owner?.followingIds || [];
    return ids.map((id) => byId.get(id)).filter(Boolean).map((p) => asCard(p as Profile));
  }
  return pool
    .filter((p) => p.id !== ownerId && (p.followingIds || []).includes(ownerId))
    .map(asCard);
}

export function FollowListSheet({
  visible,
  kind,
  userId,
  onClose,
  onOpenProfile,
}: {
  visible: boolean;
  kind: Kind;
  userId: string;
  onClose: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const spot = useSpot();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<FollowListUser[]>([]);

  useEffect(() => {
    if (!visible || !userId) return;
    let live = true;
    setLoading(true);
    const people = [spot.me, ...(spot.profiles || [])];
    const local = localFollowList(people, spot.meId, userId, kind);
    setUsers(local);

    const load = kind === 'followers' ? api.listFollowers : api.listFollowing;
    void load(userId)
      .then((data) => {
        if (!live) return;
        const next = Array.isArray(data?.users) ? data.users.filter((u) => u?.id) : [];
        if (next.length) {
          setUsers(next);
          try {
            spot.rememberProfiles(next.map(asProfile));
          } catch {
            /* */
          }
          return;
        }
        setUsers(local);
      })
      .catch(() => {
        if (!live) return;
        setUsers(local);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [visible, userId, kind]);

  if (!visible) return null;

  const title =
    kind === 'followers' ? t('profile.statFollowers') : t('profile.statFollowing');
  const empty =
    kind === 'followers'
      ? t('profile.followListEmptyFollowers')
      : t('profile.followListEmptyFollowing');
  const showSpinner = loading && users.length === 0;

  return (
    <DragSheet visible onClose={onClose} expanded>
      <Text style={styles.title}>{title}</Text>
      {showSpinner ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF5E97" />
        </View>
      ) : users.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        <View style={styles.list}>
          {users.map((u) => {
            const name = displayName(u) || u.displayName || u.name || t('nav.profile');
            const handle = usernameOf(u);
            return (
              <Pressable
                key={u.id}
                accessibilityRole="button"
                accessibilityLabel={name}
                onPress={() => {
                  onClose();
                  if (u.id === userId) return;
                  onOpenProfile?.(u.id);
                }}
                style={styles.row}
              >
                <Avatar
                  name={name}
                  uri={u.photoUrl || u.avatarUrl}
                  size={48}
                />
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  {handle ? (
                    <Text style={styles.handle} numberOfLines={1}>
                      @{handle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </DragSheet>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    title: { color: colors.ink, fontWeight: '900', fontSize: 22, marginBottom: 8 },
    center: { paddingVertical: 36, alignItems: 'center' },
    empty: {
      color: colors.muted,
      fontWeight: '700',
      fontSize: 14,
      paddingVertical: 24,
      lineHeight: 20,
    },
    list: { gap: 4, paddingBottom: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    meta: { flex: 1, minWidth: 0, gap: 2 },
    name: { color: colors.ink, fontWeight: '800', fontSize: 15 },
    handle: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  });
