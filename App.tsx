import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAndroidBack } from './src/hooks/useAndroidBack';
import { useKeyboardHeight } from './src/hooks/useKeyboard';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppShell } from './src/components/AppShell';
import { BottomNav } from './src/components/BottomNav';
import { ChatScreen } from './src/screens/ChatScreen';
import { mediaPickerOpen } from './src/media/pickPhoto';
import { ChatsScreen } from './src/screens/ChatsScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { MapScreen } from './src/screens/MapScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProScreen } from './src/screens/ProScreen';
import { ConnectionBanner } from './src/components/ConnectionBanner';
import { NoticeBanner } from './src/components/NoticeBanner';
import { ProfileSetupScreen } from './src/screens/ProfileSetupScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { ScreenTransition } from './src/components/ScreenTransition';
import { SpotProvider, useSpot } from './src/store/SpotContext';
import { listenNotificationOpen } from './src/notices/present';
import { parseAppLink, type AppLink } from './src/auth/deepLink';
import * as Linking from 'expo-linking';
import { loadWelcomeSeen, markWelcomeSeen } from './src/onboard/welcome';
import { AlertProvider } from './src/context/AlertContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AdsProvider } from './src/ads/AdsContext';
import { IapProvider } from './src/iap/IapProvider';
import './src/i18n/i18n';
import { I18nProvider } from './src/i18n/I18nProvider';
import type { MapIntent, Screen } from './src/types';

const TAB_ORDER: Exclude<Screen, 'chat'>[] = ['discover', 'map', 'chats', 'profile'];

function SystemChrome({ lightIcons }: { lightIcons: boolean }) {
  return (
    <>
      <StatusBar style={lightIcons ? 'light' : 'dark'} />
      <NavigationBar style={lightIcons ? 'light' : 'dark'} hidden={false} />
    </>
  );
}

function Root() {
  const spot = useSpot();
  const { scheme } = useTheme();
  const kbHeight = useKeyboardHeight();
  const [tab, setTab] = useState<Exclude<Screen, 'chat'>>('discover');
  const [chatId, setChatId] = useState<string | null>(null);
  const [proOpen, setProOpen] = useState(false);
  const [mapIntent, setMapIntent] = useState<MapIntent | null>(null);
  const [wall, setWall] = useState<{ userId: string; pinId?: string } | null>(null);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const dirRef = useRef(1);

  const pendingLink = useRef<AppLink | null>(null);
  const readyRef = useRef(false);
  readyRef.current = Boolean(spot.signedIn && spot.me.onboarded);

  const pending = spot.requests.filter((r) => {
    const pin = spot.pins.find((p) => p.id === r.pinId);
    return pin?.authorId === spot.meId && r.status === 'pending';
  }).length;
  const chatBadge = pending + spot.unreadChats;

  const goTab = (next: Exclude<Screen, 'chat'>) => {
    const from = TAB_ORDER.indexOf(tab);
    const to = TAB_ORDER.indexOf(next);
    dirRef.current = to >= from ? 1 : -1;
    setTab(next);
  };

  const openPro = () => {
    dirRef.current = 1;
    setProOpen(true);
  };

  const openChat = (id: string | null) => {
    dirRef.current = id ? 1 : -1;
    setChatId(id);
    if (id) setWall(null);
  };

  const openWall = (userId: string, pinId?: string) => {
    if (userId === spot.meId) {
      setWall(null);
      goTab('profile');
      return;
    }
    dirRef.current = 1;
    setChatId(null);
    setProOpen(false);
    setWall({ userId, pinId });
  };

  const applyNavLink = (link: AppLink) => {
    if (link.kind === 'none' || link.kind === 'auth') return;
    if (!readyRef.current) {
      pendingLink.current = link;
      return;
    }
    setProOpen(false);
    setWall(null);
    if (link.kind === 'chat') {
      dirRef.current = 1;
      setChatId(link.chatId);
      return;
    }
    dirRef.current = 1;
    setChatId(null);
    setTab(link.tab);
  };

  useEffect(() => {
    const onUrl = (url: string | null) => {
      if (!url) return;
      applyNavLink(parseAppLink(url));
    };
    const sub = Linking.addEventListener('url', (event) => onUrl(event.url));
    void Linking.getInitialURL().then(onUrl);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!spot.signedIn || !spot.me.onboarded || !pendingLink.current) return;
    const next = pendingLink.current;
    pendingLink.current = null;
    applyNavLink(next);
  }, [spot.signedIn, spot.me.onboarded]);

  useEffect(() => {
    if (!spot.signedIn) return;
    return listenNotificationOpen((data) => {
      setProOpen(false);
      if (data.chatId) openChat(data.chatId);
      else if (data.pinId) {
        setMapIntent({ type: 'focus', pinId: data.pinId });
        goTab('map');
      } else goTab('chats');
    });
  }, [spot.signedIn]);

  useAndroidBack(
    useCallback(() => {
      if (mediaPickerOpen) return true;
      if (wall) {
        dirRef.current = -1;
        setWall(null);
        return true;
      }
      if (chatId) {
        openChat(null);
        return true;
      }
      if (proOpen) {
        dirRef.current = -1;
        setProOpen(false);
        return true;
      }
      if (tab !== 'discover') {
        goTab('discover');
        return true;
      }
      return false;
    }, [chatId, wall, proOpen, tab]),
  );

  useEffect(() => {
    if (!spot.signedIn) {
      setWelcomeDone(false);
      return;
    }
    const id = spot.me.id;
    if (!id) return;
    let live = true;
    void loadWelcomeSeen(id).then((seen) => {
      if (live) setWelcomeDone(seen);
    });
    return () => {
      live = false;
    };
  }, [spot.signedIn, spot.me.id]);

  const phase = !spot.signedIn
    ? 'signup'
    : !spot.me.onboarded
      ? welcomeDone
        ? 'setup'
        : 'welcome'
      : 'app';
  const phaseDir = phase === 'signup' ? 0 : 1;

  const layer = wall
    ? `wall:${wall.userId}`
    : chatId
      ? `chat:${chatId}`
      : proOpen
        ? 'pro'
        : `tab:${tab}`;
  const layerDir = dirRef.current;

  if (phase !== 'app') {
    return (
      <View style={styles.safe}>
        <SystemChrome lightIcons />
        <ScreenTransition token={phase} direction={phaseDir}>
          {phase === 'signup' ? (
            <SignupScreen />
          ) : phase === 'welcome' ? (
            <WelcomeScreen
              onDone={() => {
                const id = spot.me.id;
                if (id) void markWelcomeSeen(id);
                setWelcomeDone(true);
              }}
            />
          ) : (
            <ProfileSetupScreen />
          )}
        </ScreenTransition>
        <ConnectionBanner
          visible={spot.apiDown}
          onRetry={() => {
            void spot.retryConnection();
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SystemChrome lightIcons={scheme === 'dark'} />
      <View style={styles.body}>
        <ScreenTransition token={layer} direction={layerDir}>
          {wall ? (
            <ProfileScreen
              userId={wall.userId}
              pinId={wall.pinId}
              onBack={() => {
                dirRef.current = -1;
                setWall(null);
              }}
              onOpenChat={openChat}
              onOpenProfile={openWall}
              onShowOnMap={(pinId) => {
                dirRef.current = -1;
                setWall(null);
                setChatId(null);
                setMapIntent({ type: 'focus', pinId });
                goTab('map');
              }}
            />
          ) : chatId ? (
            <ChatScreen
              chatId={chatId}
              onBack={() => openChat(null)}
              onOpenProfile={(userId, pinId) => {
                dirRef.current = 1;
                setProOpen(false);
                setWall({ userId, pinId });
              }}
            />
          ) : proOpen ? (
            <ProScreen
              onBack={() => {
                dirRef.current = -1;
                setProOpen(false);
              }}
            />
          ) : tab === 'discover' ? (
            <DiscoverScreen
              onShowOnMap={(pinId) => {
                setMapIntent({ type: 'focus', pinId });
                goTab('map');
              }}
              onCompose={() => {
                setMapIntent({ type: 'compose' });
                goTab('map');
              }}
              onOpenChat={openChat}
              onOpenPro={openPro}
              onOpenProfile={openWall}
            />
          ) : tab === 'map' ? (
            <MapScreen
              intent={mapIntent}
              onIntentConsumed={() => setMapIntent(null)}
              onOpenChat={openChat}
              onOpenChats={() => goTab('chats')}
              onOpenPro={openPro}
              onOpenProfile={openWall}
            />
          ) : tab === 'chats' ? (
            <ChatsScreen
              onOpenChat={openChat}
              onOpenMap={() => goTab('map')}
            />
          ) : (
            <ProfileScreen
              onOpenPro={openPro}
              onOpenProfile={openWall}
              onShowOnMap={(pinId) => {
                setMapIntent({ type: 'focus', pinId });
                goTab('map');
              }}
            />
          )}
        </ScreenTransition>
        <ConnectionBanner
          visible={spot.apiDown}
          onRetry={() => {
            void spot.retryConnection();
          }}
        />
        {spot.notice ? (
          <NoticeBanner
            notice={spot.notice}
            onDismiss={spot.dismissNotice}
            onOpen={() => {
              const next = spot.notice;
              spot.dismissNotice();
              setProOpen(false);
              setWall(null);
              if (next?.chatId) openChat(next.chatId);
              else if (next?.pinId) {
                setMapIntent({ type: 'focus', pinId: next.pinId });
                goTab('map');
              } else goTab('chats');
            }}
          />
        ) : null}
      </View>
      {chatId || proOpen || wall || kbHeight > 0 ? null : (
        <BottomNav current={tab} onChange={goTab} chatBadge={chatBadge} />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
        <AlertProvider>
          <AppShell>
            <SpotProvider>
              <IapProvider>
              <AdsProvider>
                <Root />
              </AdsProvider>
              </IapProvider>
            </SpotProvider>
          </AppShell>
        </AlertProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  body: { flex: 1 },
});
