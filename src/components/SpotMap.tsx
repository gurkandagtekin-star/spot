import { createElement, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
  onPlacePress: (place: MapPlace) => void;
  onPlace: (lat: number, lng: number, name: string) => void;
  onView: (lat: number, lng: number, zoom: number) => void;
};

const RESIZE_JS =
  'try{if(window.__spotMap)window.__spotMap.invalidateSize();}catch(e){} true;';

export function SpotMap({
  center,
  pins,
  places,
  draft,
  followToken = 0,
  onPinPress,
  onMapClick,
  onDraftMove,
  onPlacePress,
  onPlace,
  onView,
}: Props) {
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<{ contentWindow: { postMessage: Function } | null } | null>(
    null,
  );
  const html = useMemo(() => buildMapHtml({ center, pins }), [center.lat, center.lng]);
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
  const onPlacePressRef = useRef(onPlacePress);
  onPlacePressRef.current = onPlacePress;
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  const push = () => {
    const next = payloadRef.current;
    webRef.current?.injectJavaScript(
      `window.setMapData && window.setMapData(${next}); ${RESIZE_JS}`,
    );
    iframeRef.current?.contentWindow?.postMessage(next, '*');
  };

  useEffect(() => {
    push();
  }, [payload]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = (event: MessageEvent) => {
      handleMapMessage(event.data);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function handleMapMessage(raw: unknown) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data?.type === 'PIN_PRESS' && data.id) onPinPressRef.current(data.id);
      if (data?.type === 'MAP_CLICK') onMapClickRef.current(data.lat, data.lng);
      if (data?.type === 'MAP_DRAFT') onDraftMoveRef.current(data.lat, data.lng);
      if (data?.type === 'PLACE_PRESS' && data.id) {
        onPlacePressRef.current({
          id: data.id,
          lat: data.lat,
          lng: data.lng,
          name: data.name,
          kind: data.kind || 'place',
          emoji: data.emoji || '📍',
          category: data.category,
          area: data.area,
        });
      }
      if (data?.type === 'MAP_PLACE') {
        onPlaceRef.current(data.lat, data.lng, data.name);
      }
      if (data?.type === 'MAP_VIEW') {
        onViewRef.current(data.lat, data.lng, data.zoom);
      }
    } catch {
      /* ignore */
    }
  }

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
    <View
      style={styles.fill}
      collapsable={false}
      onLayout={() => {
        webRef.current?.injectJavaScript(RESIZE_JS);
      }}
    >
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        nestedScrollEnabled
        onLoadEnd={() => {
          push();
          setTimeout(() => webRef.current?.injectJavaScript(RESIZE_JS), 80);
          setTimeout(() => webRef.current?.injectJavaScript(RESIZE_JS), 400);
        }}
        onMessage={(e) => handleMapMessage(e.nativeEvent.data)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
  web: { flex: 1, width: '100%', height: '100%', backgroundColor: '#E7EFE6' },
});

const webIframe = {
  border: '0',
  width: '100%',
  height: '100%',
  background: '#E7EFE6',
};
