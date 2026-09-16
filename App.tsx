import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppShell } from './src/components/AppShell';
import { BottomNav } from './src/components/BottomNav';
import { ChatScreen } from './src/screens/ChatScreen';
import { ChatsScreen } from './src/screens/ChatsScreen';
import { MapScreen } from './src/screens/MapScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProScreen } from './src/screens/ProScreen';
import { ConnectionBanner } from './src/components/ConnectionBanner';
import { NoticeBanner } from './src/components/NoticeBanner';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { ScreenTransition } from './src/components/ScreenTransition';
import { SpotProvider, useSpot } from './src/store/SpotContext';
import { listenNotificationOpen } from './src/notices/present';
import { parseAppLink, type AppLink } from './src/auth/deepLink';
import * as Linking from 'expo-linking';
import { colors } from './src/theme';
import type { Screen } from './src/types';

const TAB_ORDER: Exclude<Screen, 'chat'>[] = ['map', 'chats', 'profile'];

function Root() {
  const spot = useSpot();
  const [tab, setTab] = useState<Exclude<Screen, 'chat'>>('map');
  const [chatId, setChatId] = useState<string | null>(null);
  const [proOpen, setProOpen] = useState(false);
  const dirRef = useRef(1);

  const pendingLink = useRef<AppLink | null>(null);
  const readyRef = useRef(false);
  readyRef.current = Boolean(spot.signedIn && spot.me.onboarded);

  const pending = spot.requests.filter((r) => {
    const pin = spot.pins.find((p) => p.id === r.pinId);
    return pin?.authorId === spot.meId && r.status === 'pending';
  }).length;

  const goTab = (next: Exclude<Screen, 'chat'>) => {
    const from = TAB_ORDER.indexOf(tab);
    const to = TAB_ORDER.indexOf(next);
    dirRef.current = to >= from ? 1 : -1;
    setTab(next);
  };

  const openChat = (id: string | null) => {
    dirRef.current = id ? 1 : -1;
    setChatId(id);
  };

  const applyNavLink = (link: AppLink) => {
    if (link.kind === 'none' || link.kind === 'auth') return;
    if (!readyRef.current) {
      pendingLink.current = link;
      return;
    }
    setProOpen(false);
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
      else goTab('chats');
    });
  }, [spot.signedIn]);

  const phase = !spot.signedIn ? 'signup' : !spot.me.onboarded ? 'onboard' : 'app';
  const phaseDir = phase === 'signup' ? 0 : 1;

  const layer = chatId ? `chat:${chatId}` : proOpen ? 'pro' : `tab:${tab}`;
  const layerDir = chatId || proOpen ? dirRef.current : dirRef.current;

  if (phase !== 'app') {
    return (
      <View style={styles.safe}>
        <StatusBar style="dark" />
        <ScreenTransition token={phase} direction={phaseDir}>
          {phase === 'signup' ? <SignupScreen /> : <OnboardingScreen />}
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
      <StatusBar style="dark" />
      <View style={styles.body}>
        <ScreenTransition token={layer} direction={layerDir}>
          {chatId ? (
            <ChatScreen chatId={chatId} onBack={() => openChat(null)} />
          ) : proOpen ? (
            <ProScreen
              onBack={() => {
                dirRef.current = -1;
                setProOpen(false);
              }}
            />
          ) : tab === 'map' ? (
            <MapScreen
              onOpenChat={openChat}
              onOpenPro={() => {
                dirRef.current = 1;
                setProOpen(true);
              }}
            />
          ) : tab === 'chats' ? (
            <ChatsScreen onOpenChat={openChat} />
          ) : (
            <ProfileScreen
              onOpenPro={() => {
                dirRef.current = 1;
                setProOpen(true);
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
              if (next?.chatId) openChat(next.chatId);
              else goTab('chats');
            }}
          />
        ) : null}
      </View>
      {chatId || proOpen ? null : (
        <SafeAreaView edges={['bottom']} style={styles.nav}>
          <BottomNav current={tab} onChange={goTab} chatBadge={pending} />
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell>
        <SpotProvider>
          <Root />
        </SpotProvider>
      </AppShell>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  body: { flex: 1 },
  nav: { backgroundColor: colors.paper },
});
