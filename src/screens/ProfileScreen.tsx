import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Accordion } from '../components/Accordion';
import { Avatar } from '../components/Avatar';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { PhotoPeek } from '../components/PhotoPeek';
import { BadgeRow } from '../components/BadgeRow';
import { DragSheet } from '../components/DragSheet';
import { FilterChips } from '../components/FilterChips';
import { WallNotesIcon, WallPlaceIcon } from '../components/TabIcons';
import { VIBE_TAGS, vibeLabel } from '../data/vibe';
import { ageFromBirthDate, birthDateFromParts, partsFromBirthDate } from '../birthDate';
import { usePro } from '../pro/usePro';
import { getFormattedImageUrl } from '../api';
import { pickProfilePhotos } from '../media/pickPhoto';
import { readPinCovers, visibleBio, withPinCovers } from '../pins/covers';
import { useAlert, type AlertOptions } from '../context/AlertContext';
import { useSpot } from '../store/SpotContext';
import { radius, type ColorTokens } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useKeyboardHeight } from '../hooks/useKeyboard';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../i18n/I18nProvider';
import i18n from '../i18n/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Gender, PinKind, WallMark, WallPost } from '../types';
import {
  displayName,
  GENDER_OPTIONS,
  atHandle,
  normalizeHandle,
  pinKindLabel,
  splitFullName,
  usernameOf,
} from '../utils';

type WallTab = 'notes' | 'places';

type Props = {
  onOpenPro?: () => void;
  userId?: string;
  pinId?: string;
  onBack?: () => void;
  onOpenChat?: (chatId: string) => void;
  onShowOnMap?: (pinId: string) => void;
};

export function ProfileScreen({ onOpenPro, userId, pinId, onBack, onShowOnMap }: Props) {
  const spot = useSpot();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const kbHeight = useKeyboardHeight();
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState<WallTab>('notes');
  const [edit, setEdit] = useState(false);
  const [settings, setSettings] = useState(false);
  const [vibePick, setVibePick] = useState(false);
  const [peek, setPeek] = useState(false);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [helloBusy, setHelloBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isOwnProfile = !userId || userId === spot.meId || userId === spot.me?.id;
  const isOtherProfile = !isOwnProfile;
  const person = isOwnProfile ? spot.me : spot.profileById(userId);
  const chrome = {
    edit: isOwnProfile,
    menu: isOwnProfile,
    camera: isOwnProfile,
    composer: isOwnProfile,
  };
  const wallUserId = person?.id || userId || spot.meId;

  const [feed, setFeed] = useState<WallPost[]>([]);

  useEffect(() => {
    setFeed([]);
    const id = wallUserId;
    if (!id) return;
    let live = true;
    void (async () => {
      try {
        const next = await spot.refreshWall(id);
        if (live) setFeed(next);
      } catch {
        if (live) setFeed([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [wallUserId, tab]);
  const name = person ? displayName(person) || t('nav.profile') : t('nav.profile');
  const marks = useMemo(
    () => mergeMarks(spot, person?.id || spot.meId, isOwnProfile),
    [spot.live, spot.me.wallMarks, person?.id, person?.wallMarks, isOwnProfile, spot.meId],
  );
  const markN = Math.max(person?.stats?.marks || 0, marks.length);
  const meetN = person?.stats?.meets || 0;
  const badgeN = (person?.badges || []).length + (person?.socialLeader ? 1 : 0);
  const followerN = person?.stats?.followers || 0;
  const followingN = person?.stats?.following || 0;
  const iFollow = Boolean(spot.me.followingIds?.includes(person?.id || ''));
  const vibeNote = vibeFrom(person);
  const places = useMemo(() => groupPlaces(marks), [marks]);
  const posts = feed;
  const gallery = useMemo(
    () =>
      galleryUrls(person?.photoUrl, person?.photos, marks, person?.bio)
        .map((item) => getFormattedImageUrl(item) || '')
        .filter(Boolean),
    [person?.photoUrl, person?.photos, person?.bio, marks],
  );
  const heroH = Math.max(300, Math.min(Math.round(winH * 0.48), 460));
  const bioLine = visibleBio(person?.bio || '').trim();

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  if (!person) {
    return (
      <View style={styles.page}>
        <Pressable onPress={onBack} style={{ padding: 20 }}>
          <Text style={styles.meta}>← {t('common.back')}</Text>
        </Pressable>
        <Text style={styles.meta}>{t('profile.missing')}</Text>
      </View>
    );
  }

  const publicBlock = async () => {
    const res = await spot.blockUser(person.id);
    flash(res.ok ? t('profile.blocked') : res.reason);
    if (res.ok) onBack?.();
  };

  const publicReport = async () => {
    const res = await spot.reportUser(person.id, 'rahatsiz', pinId);
    flash(res.ok ? t('profile.reported') : res.reason);
  };

  const openSafety = () => {
    showAlert({
      title: t('profile.safety'),
      message: name,
      type: 'danger',
      actions: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.report'), onPress: () => void publicReport() },
        { text: t('profile.block'), style: 'destructive', onPress: () => void publicBlock() },
      ],
    });
  };

  const toggleFollow = async () => {
    if (isOwnProfile || !person) return;
    const res = iFollow
      ? await spot.unfollowUser(person.id)
      : await spot.followUser(person.id);
    if (!res.ok) flash(res.reason);
  };

  const openHello = async () => {
    if (isOwnProfile || !person || helloBusy) return;
    setHelloBusy(true);
    const res = await spot.startHello(person.id);
    setHelloBusy(false);
    if (!res.ok) {
      flash(res.reason);
      return;
    }
    onOpenChat?.(res.chatId);
  };

  const openPlace = (item: { id: string; live?: boolean }) => {
    if (!item.live) {
      flash('Bu mark artık haritada yok.');
      return;
    }
    onShowOnMap?.(item.id);
  };

  const shareNote = async () => {
    const text = draft.trim();
    if (text.length < 2) return;
    const res = await spot.postWallNote(person.id, text);
    if (res.ok) setDraft('');
    try {
      setFeed(await spot.refreshWall(person.id));
    } catch {
      /* mevcut liste kalsın */
    }
    flash(res.ok ? t('profile.wallPosted') : res.reason);
  };

  const onRefresh = async () => {
    if (!wallUserId) return;
    setRefreshing(true);
    try {
      setFeed(await spot.refreshWall(wallUserId));
    } catch {
      setFeed([]);
    }
    setRefreshing(false);
  };

  const dropNote = async (postId: string) => {
    const res = await spot.deleteWallNote(person.id, postId);
    try {
      setFeed(await spot.refreshWall(person.id));
    } catch {
      /* */
    }
    flash(res.ok ? t('profile.noteDeleted') : res.reason);
  };

  const dockedComposer = tab === 'notes' && chrome.composer;
  const handle = usernameOf(person);

  return (
    <View style={styles.page}>
    <View style={[styles.column, { paddingBottom: kbHeight }]}>
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={[
          styles.content,
          dockedComposer ? styles.contentWithDock : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor="#FF5E97"
            colors={['#FF5E97']}
          />
        }
      >
        <View style={[styles.coverWrap, { height: heroH }]}>
          <PhotoCarousel
            uris={gallery}
            name={name}
            height={heroH}
            topInset={8}
            onLongPress={() => setPeek(true)}
          />
          <View style={styles.headerButtons} pointerEvents="box-none">
            {chrome.camera ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.add')}
                style={styles.coverChip}
                onPress={() =>
                  void changePhoto(
                    spot,
                    person.photos?.length || (person.photoUrl ? 1 : 0),
                    showAlert,
                    t,
                  )
                }
                hitSlop={8}
              >
                <Text style={styles.coverChipText}>{t('profile.add')}</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Geri"
                onPress={onBack}
                style={styles.coverChip}
                hitSlop={8}
              >
                <Text style={styles.coverChipText}>← {t('common.back')}</Text>
              </Pressable>
            )}
            {chrome.edit ? (
              <View style={styles.coverActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.editA11y')}
                  style={[styles.coverChip, { marginRight: 8 }]}
                  onPress={() => setEdit(true)}
                  hitSlop={8}
                >
                  <Text style={styles.coverChipText}>{t('profile.edit')}</Text>
                </Pressable>
                {chrome.menu ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.settings')}
                    style={styles.coverMore}
                    onPress={() => setSettings(true)}
                    hitSlop={8}
                  >
                    <View style={styles.coverDots}>
                      <View style={styles.coverDot} />
                      <View style={styles.coverDot} />
                      <View style={styles.coverDot} />
                    </View>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.safety')}
                onPress={openSafety}
                style={styles.coverChip}
                hitSlop={8}
              >
                <Text style={styles.coverChipText}>🛡</Text>
              </Pressable>
            )}
          </View>
          {isOwnProfile || vibeNote ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isOwnProfile ? t('profile.pickVibe') : t('profile.vibe')}
              hitSlop={10}
              style={styles.vibeBubble}
              onPress={() => {
                if (!isOwnProfile) return;
                setVibePick(true);
              }}
            >
              <Text style={styles.vibeBubbleTxt} numberOfLines={2}>
                {vibeNote || '+ vibe'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.bodyPad, styles.vitrine]}>
          <View style={styles.nameRow}>
            <View style={styles.nameBlock}>
              <View style={styles.nameLine}>
                <Text style={styles.title} numberOfLines={1}>
                  {name}
                </Text>
                {person.age ? (
                  <Text style={styles.ageMark}>{person.age}</Text>
                ) : null}
              </View>
              {handle ? (
                <Text style={styles.handleInline} numberOfLines={1}>
                  @{handle}
                </Text>
              ) : null}
            </View>
          </View>
          {isOtherProfile ? (
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={iFollow ? t('profile.unfollow') : t('profile.follow')}
                style={[styles.followChip, iFollow && styles.followChipOn]}
                onPress={() => void toggleFollow()}
              >
                <Text style={[styles.followChipTxt, iFollow && styles.followChipTxtOn]}>
                  {iFollow ? t('profile.following') : t('profile.follow')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.hello')}
                style={[styles.helloChip, helloBusy && { opacity: 0.5 }]}
                onPress={() => void openHello()}
              >
                <View style={styles.helloIcon}>
                  <View style={styles.helloBubble} />
                  <View style={styles.helloTail} />
                </View>
                <Text style={styles.helloTxt}>
                  {helloBusy ? '…' : t('profile.hello')}
                </Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.statStrip}>
            {[
              [String(markN), t('profile.statMark')],
              [String(meetN), t('profile.statMeet')],
              [String(followerN), t('profile.statFollowers')],
              [String(followingN), t('profile.statFollowing')],
              [String(badgeN), '★'],
            ].map(([n, label]) => (
              <View key={label} style={styles.statCell}>
                <Text style={styles.statN} numberOfLines={1}>
                  {n}
                </Text>
                <Text style={styles.statL} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
          <BadgeRow
            neon
            badges={person.badges}
            socialLeader={person.socialLeader}
          />
          <Text style={styles.bioLine} numberOfLines={3}>
            {bioLine || (isOwnProfile ? t('profile.bioOwn') : t('profile.bioEmpty'))}
          </Text>
        </View>

        <View style={styles.feedTabs}>
          {(
            [
              { id: 'notes' as const, label: t('profile.wall'), Icon: WallNotesIcon },
              { id: 'places' as const, label: t('profile.places'), Icon: WallPlaceIcon },
            ]
          ).map((item) => {
            const on = tab === item.id;
            const Icon = item.Icon;
            const tint = on ? '#FF5E97' : '#7A7168';
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: on }}
                onPress={() => setTab(item.id)}
                style={[styles.feedTab, on && styles.feedTabOn]}
              >
                <Icon color={tint} filled={on} size={22} />
                <Text style={[styles.feedTabTxt, on && styles.feedTabTxtOn]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'places' ? (
          places.length === 0 ? (
            <Text style={[styles.meta, styles.bodyPad]}>
              {isOwnProfile
                ? 'Mark koydukça takıldığın mekanlar burada birikir.'
                : 'Henüz mekan yok.'}
            </Text>
          ) : (
            places.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.name} haritada göster`}
                style={styles.placeCard}
                onPress={() => openPlace(item)}
              >
                <View style={styles.navOrb}>
                  <WallPlaceIcon color="#FF5E97" filled size={22} />
                </View>
                <View style={styles.placeBody}>
                  <Text style={styles.placeName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.placeKinds} numberOfLines={1}>
                    {item.kinds.join(' · ')}
                  </Text>
                  {item.note ? (
                    <Text style={styles.placeNote} numberOfLines={2}>
                      {item.note}
                    </Text>
                  ) : null}
                  <Text style={styles.placeMeta}>
                    {item.count} mark
                    {item.lastAt ? ` · ${wallWhen(item.lastAt)}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))
          )
        ) : (
          posts.length === 0 ? (
            <Text style={[styles.meta, styles.bodyPad]}>
              {isOwnProfile ? 'İlk notu sen yaz. Burası tweet akışın.' : 'Henüz duvar notu yok.'}
            </Text>
          ) : (
            posts.map((item: WallPost) => (
              <View key={item.id} style={[styles.tweet, styles.bodyPad]}>
                <Avatar
                  name={item.fromName || name}
                  uri={item.fromPhoto}
                  size={40}
                />
                <View style={styles.tweetBody}>
                  <View style={styles.tweetHead}>
                    <Text style={styles.tweetName} numberOfLines={1}>
                      {item.fromName || name}
                    </Text>
                    <Text style={styles.tweetTime}>{wallWhen(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.tweetText}>{item.text}</Text>
                  {isOwnProfile || item.fromId === spot.meId ? (
                    <View style={styles.tweetActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Notu sil"
                        hitSlop={8}
                        onPress={() => void dropNote(item.id)}
                      >
                        <Text style={styles.tweetDelete}>{t('profile.deleteNote')}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )
        )}

      </ScrollView>

      {dockedComposer ? (
        <View style={styles.composerDock}>
          <View style={styles.composerBar}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('profile.wallPh')}
              placeholderTextColor="#8A8190"
              maxLength={280}
              style={styles.composerMini}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.share')}
              style={[styles.shareBtn, draft.trim().length < 2 && styles.solidOff]}
              onPress={() => void shareNote()}
            >
              <Text style={styles.shareBtnTxt}>{t('profile.share')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

    </View>
      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {chrome.edit ? (
        <>
          <EditSheet visible={edit} onClose={() => setEdit(false)} />
          <VibeSheet visible={vibePick} onClose={() => setVibePick(false)} />
          <SettingsSheet
            visible={settings}
            onClose={() => setSettings(false)}
            onOpenPro={() => {
              setSettings(false);
              onOpenPro?.();
            }}
          />
        </>
      ) : null}
      <PhotoPeek
        visible={peek}
        uri={getFormattedImageUrl(person.photoUrl) || person.photoUrl}
        name={name}
        onClose={() => setPeek(false)}
      />
    </View>
  );
}

function groupPlaces(marks: WallMark[]) {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      note: string;
      kinds: string[];
      count: number;
      lastAt: number;
      live?: boolean;
    }
  >();
  for (const m of marks) {
    const name = String(m.placeName || '').trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase('tr-TR');
    const kind = pinKindLabel(m.kind);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        id: m.id,
        name,
        note: m.text,
        kinds: [kind],
        count: 1,
        lastAt: m.createdAt,
        live: Boolean(m.live),
      });
      continue;
    }
    prev.count += 1;
    if (m.live && !prev.live) {
      prev.id = m.id;
      prev.live = true;
      prev.note = m.text;
    }
    if (m.createdAt > prev.lastAt) {
      prev.lastAt = m.createdAt;
      if (!prev.live) {
        prev.id = m.id;
        prev.note = m.text;
      }
    }
    if (!prev.kinds.includes(kind)) prev.kinds.push(kind);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
}

function mergeMarks(
  spot: ReturnType<typeof useSpot>,
  userId: string,
  includeAnon: boolean,
): WallMark[] {
  const live = spot.live
    .filter((p) => p.authorId === userId && (includeAnon || !p.anonymous))
    .map((p) => ({
      id: p.id,
      text: p.text,
      kind: p.kind,
      placeName: p.kind === 'chat' ? '' : p.placeName || p.area || '',
      createdAt: p.createdAt,
      anonymous: Boolean(p.anonymous),
      live: true,
      photoUrl: p.photoUrl,
    }));
  const source =
    userId === spot.meId
      ? spot.me.wallMarks || []
      : spot.profileById(userId)?.wallMarks || [];
  const archived = source.filter(
    (m) => !live.some((p) => p.id === m.id) && (includeAnon || !m.anonymous),
  );
  return [...live, ...archived].sort((a, b) => b.createdAt - a.createdAt);
}

function wallWhen(ts: number) {
  const locale = String(i18n.language || '').startsWith('tr') ? 'tr-TR' : 'en-US';
  return new Date(ts).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });
}

async function changePhoto(
  spot: ReturnType<typeof useSpot>,
  currentCount: number,
  showAlert: (options: AlertOptions) => void,
  t: (key: string) => string,
) {
  try {
    const slots = Math.max(0, 6 - currentCount);
    if (slots <= 0) {
      showAlert({ title: t('common.photo'), message: t('profile.photoMax') });
      return;
    }
    const picked = await pickProfilePhotos(slots);
    if (!picked.length) return;
    const res = await spot.uploadPhotos(picked);
    if (!res.ok) showAlert({ title: t('common.photo'), message: res.reason });
  } catch (err) {
    showAlert({
      title: t('common.photo'),
      message: err instanceof Error ? err.message : t('profile.photoPickFail'),
    });
  }
}

function confirmDelete(
  spot: ReturnType<typeof useSpot>,
  showAlert: (options: AlertOptions) => void,
  t: (key: string) => string,
) {
  showAlert({
    title: t('profile.deleteAccount'),
    message: t('profile.deleteBody'),
    confirmText: t('profile.deleteAccount'),
    cancelText: t('common.cancel'),
    type: 'danger',
    onConfirm: () => {
      void (async () => {
        const res = await spot.deleteAccount();
        if (!res.ok) showAlert({ title: t('profile.deleteFail'), message: res.reason });
      })();
    },
  });
}

function SettingsSheet({
  visible,
  onClose,
  onOpenPro,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenPro?: () => void;
}) {
  const spot = useSpot();
  const pro = usePro();
  const { showAlert } = useAlert();
  const { scheme, setScheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  return (
    <DragSheet visible={visible} onClose={onClose} expanded>
      <Text style={styles.sheetKicker}>{t('profile.kicker')}</Text>
      <Text style={styles.sheetTitle}>{t('profile.settings')}</Text>
      <Accordion title={t('profile.language')}>
        <FilterChips
          options={[
            { id: 'tr', label: t('profile.langTr') },
            { id: 'en', label: t('profile.langEn') },
          ]}
          value={language}
          onChange={setLanguage}
        />
      </Accordion>
      <Accordion title={t('profile.appearance')}>
        <FilterChips
          options={[
            { id: 'light', label: t('profile.light') },
            { id: 'dark', label: t('profile.dark') },
          ]}
          value={scheme}
          onChange={setScheme}
        />
      </Accordion>
      <Accordion
        title={
          pro.isPro
            ? t('profile.proQuota', { limit: pro.dailyPinLimit })
            : t('profile.quotaLeft', {
                left: pro.remainingPins,
                limit: pro.dailyPinLimit,
              })
        }
      >
        <Text style={styles.meta}>
          {spot.me.email
            ? t('profile.googleEmail', { email: spot.me.email })
            : t('profile.googleBound')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark Date Pro"
          style={pro.isPro ? styles.ghost : styles.proBtn}
          onPress={onOpenPro}
        >
          <Text style={pro.isPro ? styles.ghostText : styles.proText}>
            {pro.isPro ? t('profile.proFeatures') : t('profile.goPro')}
          </Text>
        </Pressable>
      </Accordion>
      <Accordion title={t('profile.privacy')}>
        <Text style={styles.meta}>{t('profile.privacyBody')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.deleteAccount')}
          style={styles.danger}
          onPress={() => confirmDelete(spot, showAlert, t)}
        >
          <Text style={styles.dangerText}>{t('profile.deleteAccount')}</Text>
        </Pressable>
      </Accordion>
      <Accordion title={t('profile.blockedPeople')}>
        <Text style={styles.meta}>{t('profile.blockedHint')}</Text>
        {(spot.blocked || []).length === 0 ? (
          <Text style={styles.meta}>{t('profile.noneBlocked')}</Text>
        ) : (
          (spot.blocked || []).map((blocked) => (
            <View key={blocked.id} style={styles.blockRow}>
              <Avatar name={blocked.name} uri={blocked.photoUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.blockName}>{blocked.name}</Text>
                {atHandle(blocked) ? (
                  <Text style={styles.meta}>{atHandle(blocked)}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.unblockA11y', { name: blocked.name })}
                onPress={() => void spot.unblockUser(blocked.id)}
              >
                <Text style={styles.unblock}>{t('profile.unblock')}</Text>
              </Pressable>
            </View>
          ))
        )}
      </Accordion>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.signOut')}
        style={styles.signOut}
        onPress={() => void spot.signOut()}
      >
        <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
      </Pressable>
    </DragSheet>
  );
}

function vibeFrom(person?: { interests?: string[]; vibeNote?: string } | null) {
  const fromTags = (person?.interests || []).map(vibeLabel).join(' · ');
  return (fromTags || person?.vibeNote || '').trim();
}

function galleryUrls(
  photoUrl?: string,
  photos: string[] = [],
  marks: WallMark[] = [],
  bio?: string,
) {
  const urls: string[] = [];
  const add = (raw?: string) => {
    const uri = String(raw || '').trim();
    if (!uri || urls.includes(uri)) return;
    urls.push(uri);
  };
  const album = (photos || []).filter(Boolean);
  if (album.length) {
    album.forEach(add);
    add(photoUrl);
    return urls;
  }
  add(photoUrl);
  marks.forEach((m) => add(m.photoUrl));
  Object.values(readPinCovers(bio || '')).forEach(add);
  return urls;
}

function VibeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const spot = useSpot();
  const styles = useThemedStyles(createStyles);
  const [picked, setPicked] = useState<string[]>(spot.me.interests || []);

  useEffect(() => {
    if (!visible) return;
    setPicked(spot.me.interests || []);
  }, [visible, spot.me.interests]);

  const toggle = (id: string) => {
    const next = picked.includes(id)
      ? picked.filter((x) => x !== id)
      : [...picked, id].slice(0, 8);
    setPicked(next);
    const note = next.map(vibeLabel).join(' · ').slice(0, 40);
    void spot.setMyProfile({ interests: next, vibeNote: note }).catch(() => {
      setPicked(spot.me.interests || []);
    });
  };

  if (!visible) return null;

  return (
    <DragSheet visible onClose={onClose}>
      <Text style={styles.sheetKicker}>{t('profile.vibeKicker')}</Text>
      <Text style={styles.sheetTitle}>{t('profile.vibe')}</Text>
      <Text style={styles.meta}>{t('profile.vibeHint')}</Text>
      <View style={styles.tagRow}>
        {VIBE_TAGS.map((tag) => {
          const on = picked.includes(tag.id);
          return (
            <Pressable
              key={tag.id}
              accessibilityRole="button"
              accessibilityLabel={vibeLabel(tag.id)}
              accessibilityState={{ selected: on }}
              onPress={() => toggle(tag.id)}
              style={[styles.tag, on && styles.tagOn]}
            >
              <Text style={[styles.tagText, on && styles.tagTextOn]}>{vibeLabel(tag.id)}</Text>
            </Pressable>
          );
        })}
      </View>
    </DragSheet>
  );
}

function EditSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const spot = useSpot();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const split = splitFullName(spot.me.name);
  const [firstName, setFirstName] = useState(spot.me.firstName || split.firstName);
  const [lastName, setLastName] = useState(spot.me.lastName || split.lastName);
  const born = partsFromBirthDate(spot.me.birthDate);
  const [day, setDay] = useState(born.day);
  const [month, setMonth] = useState(born.month);
  const [year, setYear] = useState(born.year);
  const [gender, setGender] = useState<Gender | ''>(spot.me.gender || '');
  const [bio, setBio] = useState(visibleBio(spot.me.bio));
  const [handle, setHandle] = useState(usernameOf(spot.me));
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const next = splitFullName(spot.me.name);
    const nextBorn = partsFromBirthDate(spot.me.birthDate);
    setFirstName(spot.me.firstName || next.firstName);
    setLastName(spot.me.lastName || next.lastName);
    setDay(nextBorn.day);
    setMonth(nextBorn.month);
    setYear(nextBorn.year);
    setGender(spot.me.gender || '');
    setBio(visibleBio(spot.me.bio));
    setHandle(usernameOf(spot.me));
    setFormError(null);
    setSaved(false);
  }, [visible]);

  const save = async () => {
    try {
      setFormError(null);
      const iso = birthDateFromParts(day, month, year);
      const n = ageFromBirthDate(iso);
      if (!iso || n === null) {
        setFormError('Geçerli bir doğum tarihi yaz.');
        return;
      }
      if (n < 18 || n > 99) {
        setFormError('Yaş 18–99 arasında olmalı.');
        return;
      }
      if (firstName.trim().length < 2) {
        setFormError('Adın en az 2 harf olsun.');
        return;
      }
      const username = normalizeHandle(handle);
      if (!username) {
        setFormError('Kullanıcı adı 2–30 karakter, harf, rakam, nokta veya alt çizgi.');
        return;
      }
      await spot.setMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age: n,
        birthDate: iso,
        gender: gender || undefined,
        bio: withPinCovers(bio.trim() || visibleBio(spot.me.bio), readPinCovers(spot.me.bio)),
        username,
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 700);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    }
  };

  if (!visible) return null;

  return (
    <DragSheet visible onClose={onClose} keyboard expanded>
      <Text style={styles.sheetKicker}>{t('profile.editKicker')}</Text>
      <Text style={styles.sheetTitle}>{t('profile.streetId')}</Text>
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{t('profile.firstName')}</Text>
          <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{t('profile.lastName')}</Text>
          <TextInput value={lastName} onChangeText={setLastName} style={styles.input} />
        </View>
      </View>
      <Text style={styles.label}>{t('profile.birth')}</Text>
      <View style={styles.dateRow}>
        <TextInput
          value={day}
          onChangeText={(v) => setDay(v.replace(/[^\d]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          placeholder="GG"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.dateBox]}
        />
        <TextInput
          value={month}
          onChangeText={(v) => setMonth(v.replace(/[^\d]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          placeholder="AA"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.dateBox]}
        />
        <TextInput
          value={year}
          onChangeText={(v) => setYear(v.replace(/[^\d]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="YYYY"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.dateYear]}
        />
      </View>
      <Text style={styles.label}>{t('profile.gender')}</Text>
      <FilterChips
        wrap
        options={GENDER_OPTIONS.map((opt) => ({
          id: opt.id,
          label: t(opt.labelKey),
        }))}
        value={(gender || '__none__') as Gender}
        onChange={setGender}
      />
      <Text style={styles.label}>{t('profile.username')}</Text>
      <View style={styles.handleRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          value={handle}
          onChangeText={(v) => setHandle(v.replace(/^@/, '').toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('profile.usernamePh')}
          placeholderTextColor={colors.muted}
          style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
        />
      </View>
      <Text style={styles.label}>{t('profile.wallNote')}</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder={t('profile.wallNotePh')}
        placeholderTextColor={colors.muted}
        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
      />
      {formError ? <Text style={styles.meta}>{formError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.save')}
        style={styles.cta}
        onPress={() => void save()}
      >
        <Text style={styles.ctaText}>{saved ? t('common.saved') : t('common.save')}</Text>
      </Pressable>
    </DragSheet>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1 },
    column: { flex: 1, minHeight: 0 },
    scroller: { flex: 1, minHeight: 0 },
    content: { flexGrow: 1, width: '100%', paddingBottom: 20, gap: 12 },
    contentWithDock: { paddingBottom: 12 },
    bodyPad: { paddingHorizontal: 16 },
    coverWrap: {
      width: '100%',
      position: 'relative',
    },
    headerButtons: {
      position: 'absolute',
      top: 40,
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 999,
      elevation: 5,
    },
    coverChip: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      elevation: 10,
      zIndex: 999,
    },
    coverChipText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    coverActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coverMore: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 10,
      zIndex: 999,
    },
    coverDots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    coverDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
    avatarHang: {
      position: 'absolute',
      left: 16,
      bottom: 0,
      width: 102,
      height: 102,
      zIndex: 4,
      overflow: 'visible',
    },
    glowOuter: {
      position: 'absolute',
      left: -10,
      top: -10,
      right: -10,
      bottom: -10,
      borderRadius: 61,
      backgroundColor: 'rgba(255, 94, 151, 0.28)',
    },
    glowInner: {
      position: 'absolute',
      left: -4,
      top: -4,
      right: -4,
      bottom: -4,
      borderRadius: 55,
      backgroundColor: 'rgba(255, 200, 80, 0.18)',
    },
    ring: {
      position: 'absolute',
      left: 2,
      top: 2,
      borderWidth: 3,
      borderColor: '#FF5E97',
      borderRadius: 50,
      padding: 2,
      backgroundColor: colors.paper,
      shadowColor: '#FF5E97',
      shadowOpacity: 0.85,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
    vitrine: { paddingTop: 4, gap: 10 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    nameBlock: { flex: 1, minWidth: 0, gap: 4 },
    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    ageMark: {
      fontSize: 18,
      lineHeight: 28,
      fontWeight: '700',
      color: colors.muted,
      includeFontPadding: false,
    },
    handleInline: { color: colors.muted, fontWeight: '700', fontSize: 13, marginTop: 2 },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    followChip: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: '#FF5E97',
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
      shadowColor: '#FF5E97',
      shadowOpacity: 0.45,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
    },
    followChipOn: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: '#FF5E97',
      shadowOpacity: 0,
    },
    followChipTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
    followChipTxtOn: { color: '#FF5E97' },
    helloChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.paper,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1.5,
      borderColor: '#C084FC',
    },
    helloIcon: { width: 14, height: 12, justifyContent: 'flex-end' },
    helloBubble: {
      width: 12,
      height: 9,
      borderRadius: 4,
      backgroundColor: '#C084FC',
    },
    helloTail: {
      width: 0,
      height: 0,
      marginLeft: 2,
      marginTop: -1,
      borderLeftWidth: 4,
      borderTopWidth: 4,
      borderLeftColor: 'transparent',
      borderTopColor: '#C084FC',
    },
    helloTxt: { color: '#C084FC', fontWeight: '800', fontSize: 12 },
    bioLine: { color: colors.ink, fontWeight: '600', fontSize: 14, lineHeight: 20 },
    igHit: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(232, 90, 155, 0.12)',
    },
    vibeBubble: {
      position: 'absolute',
      left: 16,
      bottom: 14,
      maxWidth: 160,
      zIndex: 999,
      elevation: 10,
      backgroundColor: 'rgba(18, 8, 28, 0.92)',
      borderWidth: 1,
      borderColor: '#FF5E97',
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    vibeBubbleTxt: { color: '#fff', fontWeight: '800', fontSize: 11, lineHeight: 14 },
    statStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.paperSoft,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 2,
    },
    statCell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
    tweetDelete: { color: colors.warning, fontWeight: '800', fontSize: 13 },
    highlights: { gap: 12, paddingVertical: 4 },
    hiItem: { width: 74, alignItems: 'center', gap: 6 },
    hiRing: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 2.5,
      borderColor: '#FF5E97',
      padding: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hiEmpty: { borderStyle: 'dashed', borderColor: 'rgba(255,94,151,0.45)' },
    hiPlus: { color: '#FF5E97', fontSize: 22, fontWeight: '300' },
    hiImg: { width: 58, height: 58, borderRadius: 29 },
    hiFallback: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hiFallbackTxt: { color: colors.coral, fontWeight: '900', fontSize: 18 },
    hiLabel: { color: colors.ink, fontWeight: '700', fontSize: 11, textAlign: 'center' },
    feedTabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    feedTab: {
      flex: 1,
      paddingTop: 8,
      paddingBottom: 10,
      alignItems: 'center',
      gap: 4,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    feedTabOn: { borderBottomColor: '#FF5E97' },
    feedTabTxt: { color: colors.muted, fontWeight: '800', fontSize: 10, letterSpacing: 0.3 },
    feedTabTxtOn: { color: '#FF5E97' },
    placeCard: {
      flexDirection: 'row',
      gap: 12,
      marginHorizontal: 16,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
    },
    navOrb: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,94,151,0.12)',
      borderWidth: 1.5,
      borderColor: '#FF5E97',
    },
    placeBody: { flex: 1, gap: 3, justifyContent: 'center' },
    placeName: { color: colors.ink, fontWeight: '900', fontSize: 16 },
    placeKinds: { color: '#FF5E97', fontWeight: '800', fontSize: 11 },
    placeNote: { color: colors.ink, fontWeight: '600', fontSize: 13, lineHeight: 18 },
    placeMeta: { color: colors.muted, fontWeight: '700', fontSize: 12 },
    tweet: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    tweetBody: { flex: 1, gap: 4 },
    tweetHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tweetName: { fontWeight: '900', color: colors.ink, flexShrink: 1 },
    tweetTime: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    tweetKind: { color: colors.coral, fontWeight: '800', fontSize: 11 },
    tweetText: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '600' },
    tweetMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    tweetActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 },
    composerDock: {
      flexShrink: 0,
      zIndex: 4,
      elevation: 8,
      backgroundColor: colors.paper,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'android' ? 10 : 8,
    },
    composerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.paperSoft,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.line,
      paddingLeft: 14,
      paddingRight: 6,
      paddingVertical: 4,
    },
    composerMini: {
      flex: 1,
      color: colors.ink,
      fontSize: 14,
      fontWeight: '600',
      paddingVertical: 8,
    },
    shareBtn: {
      backgroundColor: '#FF5E97',
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    shareBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 13 },
    reviewCard: {
      gap: 4,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    reviewStar: { color: colors.gold, fontWeight: '800', fontSize: 12 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    vibePill: {
      borderWidth: 1.5,
      borderRadius: radius.pill,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: 'rgba(255,94,151,0.08)',
    },
    vibePillText: { fontWeight: '800', fontSize: 12 },
    floatBar: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(18, 10, 24, 0.88)',
      borderWidth: 1,
      borderColor: 'rgba(255, 94, 151, 0.45)',
      borderRadius: 28,
      paddingHorizontal: 10,
      paddingTop: 10,
    },
    floatIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    floatIconGhost: { width: 46, height: 46 },
    floatIconTxt: { color: '#fff', fontWeight: '900', fontSize: 13 },
    floatCta: {
      flex: 1,
      backgroundColor: colors.coral,
      borderRadius: 22,
      paddingVertical: 14,
      alignItems: 'center',
      shadowColor: '#FF5E97',
      shadowOpacity: 0.55,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    floatCtaTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
    title: {
      flexShrink: 1,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '900',
      color: colors.ink,
      includeFontPadding: false,
    },
    handle: {
      color: colors.muted,
      fontWeight: '700',
      marginTop: 4,
      fontSize: 16,
      textShadowColor: 'rgba(232, 90, 155, 0.7)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    lead: { color: colors.muted, marginTop: 2, fontSize: 13 },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stat: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 88,
      backgroundColor: colors.paperSoft,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.line,
    },
    statN: { fontSize: 16, fontWeight: '900', color: colors.ink },
    statL: { fontSize: 9, fontWeight: '800', color: colors.muted },
    panel: {
      backgroundColor: colors.paper,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 14,
      gap: 10,
    },
    panelTitle: { fontWeight: '800', color: colors.ink, fontSize: 14 },
    note: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '600' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    tagOn: { backgroundColor: colors.chipOnBg, borderColor: '#fff' },
    tagText: { color: colors.ink, fontWeight: '800', fontSize: 12 },
    tagTextOn: { color: '#fff' },
    markCard: {
      backgroundColor: colors.paperSoft,
      borderRadius: 12,
      padding: 10,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.line,
    },
    markTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    markKind: { color: colors.coral, fontWeight: '800', fontSize: 12 },
    liveDot: { color: colors.teal, fontWeight: '800', fontSize: 12 },
    anonDot: { color: colors.muted, fontWeight: '800', fontSize: 12 },
    markText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
    markMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    closeMark: { color: colors.warning, fontWeight: '800', marginTop: 4 },
    sheetKicker: {
      color: colors.coral,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      fontSize: 11,
    },
    sheetTitle: { fontSize: 22, fontWeight: '900', color: colors.ink, marginTop: -4 },
    twoCol: { flexDirection: 'row', gap: 10 },
    dateRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    dateBox: { flex: 1, textAlign: 'center' },
    dateYear: { flex: 1.4, textAlign: 'center' },
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
    cta: {
      marginTop: 10,
      backgroundColor: colors.coral,
      borderRadius: radius.md,
      paddingVertical: 13,
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
    signOut: {
      marginTop: 4,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: 'rgba(220, 38, 38, 0.12)',
      borderWidth: 1,
      borderColor: colors.warning,
    },
    signOutText: { color: colors.warning, fontWeight: '800', fontSize: 15 },
    proBtn: {
      marginTop: 8,
      backgroundColor: colors.ink,
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    proText: { color: '#fff', fontWeight: '800' },
    meta: { color: colors.muted, lineHeight: 20 },
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
    solidOff: { backgroundColor: colors.muted, opacity: 0.7 },
    toast: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 18,
      backgroundColor: 'rgba(31,26,23,0.92)',
      borderRadius: radius.pill,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    toastText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  });
