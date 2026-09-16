import { createElement, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildMapHtml } from '../map/buildMapHtml';
import type { MapPinPayload, MapPlace } from '../types';

type Props = {
  center: { lat: number; lng: number };
  pins: MapPinPayload[];
  places: MapPlace[];
  draft: { lat: number; lng: number } | null;
  followToken?: number;
  onPinPress: (id: string) => void;
  onMapClick: (lat: number, lng: number) => void;
  onDraftMove: (lat: number, lng: number) => void;
  onPlace: (lat: number, lng: number, name: string) => void;
  onView: (lat: number, lng: number, zoom: number) => void;
};

export function SpotMap({
  center,
  pins,
  places,
  draft,
  followToken = 0,
  onPinPress,
  onMapClick,
  onDraftMove,
  onPlace,
  onView,
}: Props) {
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<{ contentWindow: { postMessage: Function } | null } | null>(
    null,
  );
  const html = useMemo(() => buildMapHtml({ center, pins }), [4]);
  const payload = useMemo(
    () => JSON.stringify({ center, pins, places, draft, followToken }),
    [center, pins, places, draft, followToken],
  );
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const onPinPressRef = useRef(onPinPress);
  onPinPressRef.current = onPinPress;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onDraftMoveRef = useRef(onDraftMove);
  onDraftMoveRef.current = onDraftMove;
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  const push = () => {
    const next = payloadRef.current;
    webRef.current?.injectJavaScript(
      `window.setMapData && window.setMapData(${next}); true;`,
    );
    iframeRef.current?.contentWindow?.postMessage(next, '*');
  };

  useEffect(() => {
    push();
  }, [payload]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'PIN_PRESS' && data.id) onPinPressRef.current(data.id);
        if (data?.type === 'MAP_CLICK') onMapClickRef.current(data.lat, data.lng);
        if (data?.type === 'MAP_DRAFT') onDraftMoveRef.current(data.lat, data.lng);
        if (data?.type === 'MAP_PLACE') {
          onPlaceRef.current(data.lat, data.lng, data.name);
        }
        if (data?.type === 'MAP_VIEW') {
          onViewRef.current(data.lat, data.lng, data.zoom);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (Platform.OS === 'web') {
    return createElement('iframe', {
      ref: iframeRef,
      title: 'Mark Date harita',
      srcDoc: html,
      style: webIframe,
      sandbox: 'allow-scripts allow-same-origin',
      onLoad: push,
    });
  }

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html }}
      style={styles.fill}
      onLoadEnd={push}
      onMessage={(e) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          if (data?.type === 'PIN_PRESS' && data.id) onPinPress(data.id);
          if (data?.type === 'MAP_CLICK') onMapClick(data.lat, data.lng);
          if (data?.type === 'MAP_DRAFT') onDraftMove(data.lat, data.lng);
          if (data?.type === 'MAP_PLACE') onPlace(data.lat, data.lng, data.name);
          if (data?.type === 'MAP_VIEW') onView(data.lat, data.lng, data.zoom);
        } catch {
          /* ignore */
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#E7EFE6' },
});

const webIframe = {
  border: '0',
  width: '100%',
  height: '100%',
  background: '#E7EFE6',
};
