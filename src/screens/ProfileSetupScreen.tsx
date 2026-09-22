import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ageFromBirthDate, birthDateFromParts, partsFromBirthDate } from '../birthDate';
import { Avatar } from '../components/Avatar';
import { KeyboardGate } from '../components/KeyboardGate';
import { KEYBOARD_SCROLL_PAD, useKeyboardHeight } from '../hooks/useKeyboard';
import { pickProfilePhoto } from '../media/pickPhoto';
import { useSpot } from '../store/SpotContext';
import type { Gender } from '../types';
import { GENDER_OPTIONS, normalizeHandle, splitFullName } from '../utils';
import { useTranslation } from 'react-i18next';

const BG = '#0A0A0A';
const MUTED = 'rgba(255,255,255,0.55)';
const LINE = 'rgba(255,255,255,0.18)';
const GLOW = '#FF5E97';
const STEPS = 3;

export function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const spot = useSpot();
  const { t } = useTranslation();
  const split = splitFullName(spot.me.name);
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState(
    (spot.me.firstName || split.firstName || '').trim(),
  );
  const born = partsFromBirthDate(spot.me.birthDate);
  const [day, setDay] = useState(born.day);
  const [month, setMonth] = useState(born.month);
  const [year, setYear] = useState(born.year);
  const [gender, setGender] = useState<Gender | ''>(spot.me.gender || '');
  const [handle, setHandle] = useState(spot.me.username || '');
  const defaultBio = t('setup.defaultBio');
  const [bio, setBio] = useState(() => {
    const current = spot.me.bio;
    if (!current || current === 'Yüz yüze tanışmayı seviyorum.' || current === defaultBio) {
      return '';
    }
    return current;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aliasFocus, setAliasFocus] = useState(false);

  const birthDate = useMemo(
    () => birthDateFromParts(day, month, year),
    [day, month, year],
  );
  const age = useMemo(() => ageFromBirthDate(birthDate), [birthDate]);
  const identityReady =
    alias.trim().length >= 2 && Boolean(gender) && age !== null && age >= 18 && age <= 99;

  const saveIdentity = async () => {
    const name = alias.trim();
    if (name.length < 2) {
      setError(t('setup.aliasMin'));
      return false;
    }
    const iso = birthDate;
    if (!iso || age === null) {
      setError(t('profile.validBirth'));
      return false;
    }
    if (age < 18) {
      setError(t('setup.under18'));
      return false;
    }
    if (age > 99) {
      setError(t('profile.ageRange'));
      return false;
    }
    if (!gender) {
      setError(t('setup.pickGender'));
      return false;
    }
    await spot.setMyProfile({
      firstName: name,
      lastName: '',
      name,
      age,
      birthDate: iso,
      gender,
    });
    return true;
  };

  const photo = async () => {
    setError(null);
    try {
      const picked = await pickProfilePhoto();
      if (!picked) return;
      const res = await spot.uploadPhoto(picked.dataUrl, picked.uri);
      if (!res.ok) setError(res.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.photoPickFail'));
    }
  };

  const onContinue = async () => {
    setError(null);
    if (step === 0) {
      setBusy(true);
      try {
        const ok = await saveIdentity();
        if (ok) setStep(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('profile.saveFail'));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    const next = normalizeHandle(handle);
    if (next === null) {
      setError(t('setup.usernameRule'));
      return;
    }
    setBusy(true);
    try {
      const iso = birthDate || spot.me.birthDate;
      const n = age ?? ageFromBirthDate(iso) ?? spot.me.age ?? 18;
      await spot.setMyProfile({
        firstName: alias.trim(),
        lastName: '',
        name: alias.trim(),
        age: n,
        ...(iso ? { birthDate: iso } : {}),
        gender: gender || undefined,
        ...(next ? { username: next } : {}),
        bio: bio.trim() || t('setup.defaultBio'),
      });
      const res = await spot.finishOnboarding();
      if (!res.ok) setError(res.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.saveFail'));
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel =
    busy ? t('setup.saving') : step === 2 ? t('setup.toMap') : t('setup.continue');
  const ctaReady = step === 0 ? identityReady && !busy : !busy;

  return (
    <KeyboardGate style={styles.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.inner,
          {
            paddingTop: insets.top + 18,
            paddingBottom: Math.max(insets.bottom, 20) + (kbHeight > 0 ? KEYBOARD_SCROLL_PAD : 0),
          },
        ]}
      >
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#FF5E97', '#FF8A6A']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.progressFill, { width: `${((step + 1) / STEPS) * 100}%` }]}
          />
        </View>
        <Text style={styles.kicker}>{t('setup.step', { n: step + 1, total: STEPS })}</Text>

        {step === 0 ? (
          <>
            <Text style={styles.title}>{t('setup.titleName')}</Text>
            <Text style={styles.lead}>{t('setup.leadName')}</Text>
            <Text style={styles.label}>{t('setup.alias')}</Text>
            <TextInput
              value={alias}
              onChangeText={setAlias}
              placeholder={t('setup.alias')}
              placeholderTextColor="rgba(255,255,255,0.28)"
              autoCapitalize="words"
              autoCorrect={false}
              onFocus={() => setAliasFocus(true)}
              onBlur={() => setAliasFocus(false)}
              style={[styles.underline, aliasFocus && styles.underlineOn]}
            />
            <Text style={styles.label}>{t('setup.birth')}</Text>
            <View style={styles.dateRow}>
              <TextInput
                value={day}
                onChangeText={(v) => setDay(v.replace(/[^\d]/g, '').slice(0, 2))}
                placeholder={t('setup.phDay')}
                placeholderTextColor="rgba(255,255,255,0.28)"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.dateBox}
              />
              <Text style={styles.dateSep}>/</Text>
              <TextInput
                value={month}
                onChangeText={(v) => setMonth(v.replace(/[^\d]/g, '').slice(0, 2))}
                placeholder={t('setup.phMonth')}
                placeholderTextColor="rgba(255,255,255,0.28)"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.dateBox}
              />
              <Text style={styles.dateSep}>/</Text>
              <TextInput
                value={year}
                onChangeText={(v) => setYear(v.replace(/[^\d]/g, '').slice(0, 4))}
                placeholder={t('setup.phYear')}
                placeholderTextColor="rgba(255,255,255,0.28)"
                keyboardType="number-pad"
                maxLength={4}
                style={[styles.dateBox, styles.yearBox]}
              />
            </View>
            {age !== null && age >= 18 && age <= 99 ? (
              <Text style={styles.ageHint}>{t('setup.ageNow', { age })}</Text>
            ) : (
              <Text style={styles.ageHint}>{t('setup.ageFromBirth')}</Text>
            )}
            <Text style={styles.label}>{t('setup.gender')}</Text>
            <View style={styles.genderGrid}>
              {GENDER_OPTIONS.map((opt) => {
                const on = gender === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setGender(opt.id)}
                    style={[styles.genderBtn, on && styles.genderOn]}
                  >
                    <Text style={[styles.genderText, on && styles.genderTextOn]}>
                      {t(opt.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.title}>{t('setup.titleFace')}</Text>
            <Text style={styles.lead}>{t('setup.leadFace')}</Text>
            <Pressable onPress={() => void photo()} style={styles.photoWrap}>
              <Avatar name={alias || spot.me.name} uri={spot.me.photoUrl} size={120} />
              <Text style={styles.photoHint}>{t('setup.pickGallery')}</Text>
            </Pressable>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>{t('setup.titleLast')}</Text>
            <Text style={styles.lead}>{t('setup.leadLast')}</Text>
            <Text style={styles.label}>{t('setup.username')}</Text>
            <View style={styles.handleRow}>
              <Text style={styles.at}>@</Text>
              <TextInput
                value={handle}
                onChangeText={(v) => setHandle(v.replace(/^@/, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('setup.phHandle')}
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={styles.handleInput}
              />
            </View>
            <Text style={styles.ageHint}>{t('setup.handleHint')}</Text>
            <Text style={styles.label}>{t('setup.bio')}</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={t('setup.phBio')}
              placeholderTextColor="rgba(255,255,255,0.28)"
              multiline
              style={styles.bio}
            />
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footer}>
          {step > 0 ? (
            <Pressable
              onPress={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
            >
              <Text style={styles.skip}>{t('common.back')}</Text>
            </Pressable>
          ) : null}
          {step === 1 ? (
            <Pressable
              onPress={() => {
                setError(null);
                setStep(2);
              }}
            >
              <Text style={styles.skip}>{t('setup.skip')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={!ctaReady}
            onPress={() => {
              void onContinue();
            }}
            style={[styles.ctaWrap, !ctaReady && styles.ctaOff]}
          >
            <LinearGradient
              colors={ctaReady ? ['#FF5E97', '#FF7A59'] : ['#2A2A2A', '#2A2A2A']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardGate>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BG },
  inner: { flexGrow: 1, paddingHorizontal: 24 },
  progressTrack: {
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginBottom: 22,
  },
  progressFill: { height: '100%' },
  kicker: {
    color: GLOW,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 11,
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  lead: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  label: {
    color: 'rgba(255,255,255,0.86)',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 10,
    marginTop: 18,
  },
  underline: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: LINE,
  },
  underlineOn: { borderBottomColor: GLOW },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBox: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 14,
  },
  yearBox: { flex: 1.35 },
  dateSep: { color: MUTED, fontWeight: '800', fontSize: 16 },
  ageHint: { color: MUTED, fontSize: 12, marginTop: 8 },
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genderBtn: {
    minWidth: '47%',
    flexGrow: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#121212',
    borderWidth: 1.5,
    borderColor: LINE,
    alignItems: 'center',
  },
  genderOn: {
    borderColor: GLOW,
    backgroundColor: 'rgba(255,94,151,0.12)',
    shadowColor: GLOW,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  genderText: {
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  genderTextOn: { color: '#fff' },
  photoWrap: { alignItems: 'center', gap: 12, marginTop: 24 },
  photoHint: { color: GLOW, fontWeight: '800' },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    paddingLeft: 12,
    backgroundColor: '#121212',
  },
  at: { fontWeight: '800', color: MUTED, fontSize: 18 },
  handleInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 14,
    paddingRight: 12,
  },
  bio: {
    minHeight: 90,
    textAlignVertical: 'top',
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#121212',
  },
  error: { color: '#FFD6A8', fontWeight: '700', marginTop: 16 },
  footer: { marginTop: 'auto', paddingTop: 28, gap: 12 },
  skip: { textAlign: 'center', color: MUTED, fontWeight: '700' },
  ctaWrap: { borderRadius: 18, overflow: 'hidden' },
  ctaOff: { opacity: 0.45 },
  cta: { paddingVertical: 16, alignItems: 'center', borderRadius: 18 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
