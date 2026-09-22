import { AppState, Platform } from 'react-native';
import type { AppNotice } from '../types';
import i18n from '../i18n/i18n';

let handlerReady = false;
let remotePushReady = false;
let lastExpoToken: string | null = null;

async function native() {
  return import('expo-notifications');
}

export function hasRemotePush() {
  return remotePushReady;
}

export function lastPushToken() {
  return lastExpoToken;
}

export async function prepareNotices() {
  try {
    if (Platform.OS === 'web') {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      return;
    }
    const Notifications = await native();
    if (!handlerReady) {
      Notifications.setNotificationHandler({
        handleNotification: async () => {
          const active = AppState.currentState === 'active';
          return {
            shouldPlaySound: !active,
            shouldSetBadge: true,
            shouldShowBanner: !active,
            shouldShowList: true,
          };
        },
      });
      handlerReady = true;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('mark-date', {
        name: i18n.t('chats.title'),
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 80, 180],
        lightColor: '#E35D4A',
        color: '#1E1B2C',
      });
    }
    await Notifications.requestPermissionsAsync();
  } catch {
    /* izin yoksa banner yine çalışır */
  }
}

export async function registerExpoPush(
  save: (token: string) => Promise<void>,
) {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await native();
    const Constants = (await import('expo-constants')).default;
    const projectId =
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
      process.env.EAS_PROJECT_ID ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;
    if (!projectId) return;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const value = token?.data;
    if (!value) return;
    lastExpoToken = value;
    remotePushReady = true;
    await save(value);
  } catch {
    remotePushReady = false;
  }
}

export async function presentSystemNotice(notice: AppNotice) {
  try {
    if (Platform.OS === 'web') {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      new Notification(notice.title, { body: notice.body });
      return;
    }
    if (remotePushReady) return;
    const Notifications = await native();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notice.title,
        body: notice.body,
        sound: 'default',
        data: {
          type: notice.type,
          chatId: notice.chatId || '',
          pinId: notice.pinId || '',
        },
      },
      trigger: null,
    });
  } catch {
    /* sistem bildirimi yoksa in-app yeter */
  }
}

let consumedLaunch = false;

export function listenNotificationOpen(
  onOpen: (data: { chatId?: string; pinId?: string }) => void,
) {
  if (Platform.OS === 'web') return () => {};
  let remove: (() => void) | undefined;
  void native().then((Notifications) => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      onOpen({
        chatId: typeof data.chatId === 'string' && data.chatId ? data.chatId : undefined,
        pinId: typeof data.pinId === 'string' && data.pinId ? data.pinId : undefined,
      });
    });
    if (!consumedLaunch && typeof Notifications.getLastNotificationResponseAsync === 'function') {
      void Notifications.getLastNotificationResponseAsync()
        .then((last) => {
          if (consumedLaunch || !last) return;
          consumedLaunch = true;
          const data = last.notification.request.content.data;
          if (!data) return;
          onOpen({
            chatId: typeof data.chatId === 'string' && data.chatId ? data.chatId : undefined,
            pinId: typeof data.pinId === 'string' && data.pinId ? data.pinId : undefined,
          });
        })
        .catch(() => {});
    }
    remove = () => sub.remove();
  });
  return () => remove?.();
}
