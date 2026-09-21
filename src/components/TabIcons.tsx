import { View } from 'react-native';

type IconProps = {
  color: string;
  filled?: boolean;
  size?: number;
};

export function DiscoverTabIcon({ color, filled, size = 24 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: s * 0.42,
          height: s * 0.42,
          borderRadius: s,
          backgroundColor: filled ? color : 'transparent',
          borderWidth: filled ? 0 : 2,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: s * 0.72,
          height: s * 0.72,
          borderRadius: s,
          borderWidth: 1.5,
          borderColor: color,
          opacity: filled ? 0.55 : 0.35,
        }}
      />
    </View>
  );
}

export function MapTabIcon({ color, filled, size = 24 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center' }}>
      <View
        style={{
          width: s * 0.58,
          height: s * 0.58,
          borderRadius: s * 0.29,
          borderWidth: filled ? 0 : 2,
          borderColor: color,
          backgroundColor: filled ? color : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        <View
          style={{
            width: s * 0.16,
            height: s * 0.16,
            borderRadius: s,
            backgroundColor: filled ? '#fff' : color,
          }}
        />
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: s * 0.15,
          borderRightWidth: s * 0.15,
          borderTopWidth: s * 0.2,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
        }}
      />
    </View>
  );
}

export function ChatTabIcon({ color, filled, size = 24 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: s * 0.78,
          height: s * 0.58,
          borderRadius: s * 0.22,
          borderWidth: filled ? 0 : 2,
          borderColor: color,
          backgroundColor: filled ? color : 'transparent',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: s * 0.1,
          left: s * 0.22,
          width: 0,
          height: 0,
          borderLeftWidth: s * 0.1,
          borderRightWidth: s * 0.02,
          borderTopWidth: s * 0.16,
          borderLeftColor: color,
          borderRightColor: 'transparent',
          borderTopColor: color,
        }}
      />
    </View>
  );
}

export function ProfileTabIcon({ color, filled, size = 24 }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View
        style={{
          width: s * 0.32,
          height: s * 0.32,
          borderRadius: s,
          borderWidth: filled ? 0 : 2,
          borderColor: color,
          backgroundColor: filled ? color : 'transparent',
          marginBottom: 2,
        }}
      />
      <View
        style={{
          width: s * 0.7,
          height: s * 0.34,
          borderTopLeftRadius: s,
          borderTopRightRadius: s,
          borderWidth: filled ? 0 : 2,
          borderBottomWidth: 0,
          borderColor: color,
          backgroundColor: filled ? color : 'transparent',
        }}
      />
    </View>
  );
}

export function PlusIcon({ color = '#fff', size = 22 }: { color?: string; size?: number }) {
  const t = Math.max(2, Math.round(size * 0.14));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.72,
          height: t,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: t,
          height: size * 0.72,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function LocateIcon({ color, size = 22 }: { color: string; size?: number }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: s * 0.78,
          height: s * 0.78,
          borderRadius: s,
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: s * 0.22,
            height: s * 0.22,
            borderRadius: s,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function WallPlaceIcon({ color, filled, size = 22 }: IconProps) {
  return <MapTabIcon color={color} filled={filled} size={size} />;
}

export function WallNotesIcon({ color, filled, size = 22 }: IconProps) {
  const s = size;
  const line = (w: number, top: number) => (
    <View
      key={`${w}-${top}`}
      style={{
        position: 'absolute',
        top,
        left: s * 0.18,
        width: s * w,
        height: filled ? 2.5 : 2,
        borderRadius: 2,
        backgroundColor: color,
        opacity: filled ? 1 : 0.85,
      }}
    />
  );
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: s * 0.82,
          height: s * 0.72,
          borderRadius: 6,
          borderWidth: filled ? 0 : 1.8,
          borderColor: color,
          backgroundColor: filled ? color : 'transparent',
        }}
      />
      {filled
        ? [
            <View
              key="a"
              style={{
                position: 'absolute',
                top: s * 0.28,
                left: s * 0.22,
                width: s * 0.5,
                height: 2.5,
                borderRadius: 2,
                backgroundColor: '#fff',
              }}
            />,
            <View
              key="b"
              style={{
                position: 'absolute',
                top: s * 0.46,
                left: s * 0.22,
                width: s * 0.34,
                height: 2.5,
                borderRadius: 2,
                backgroundColor: '#fff',
              }}
            />,
          ]
        : [line(0.5, s * 0.28), line(0.34, s * 0.46)]}
    </View>
  );
}

export function WallStarIcon({ color, filled, size = 22 }: IconProps) {
  const s = size;
  const diamond = (scale: number, extra?: object) => (
    <View
      style={{
        position: 'absolute',
        width: s * scale,
        height: s * scale,
        borderRadius: 2,
        borderWidth: filled ? 0 : 1.6,
        borderColor: color,
        backgroundColor: filled ? color : 'transparent',
        transform: [{ rotate: '45deg' }],
        ...extra,
      }}
    />
  );
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {diamond(0.42)}
      {diamond(0.28, { opacity: filled ? 1 : 0.55 })}
    </View>
  );
}

export function IgMarkIcon({ color = '#E85A9B', size = 16 }: { color?: string; size?: number }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: s,
          height: s,
          borderRadius: s * 0.28,
          borderWidth: 1.7,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: s * 0.42,
          height: s * 0.42,
          borderRadius: s,
          borderWidth: 1.6,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: s * 0.16,
          right: s * 0.16,
          width: s * 0.12,
          height: s * 0.12,
          borderRadius: s,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function CameraBadgeIcon({ color = '#fff', size = 12 }: { color?: string; size?: number }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: s,
          height: s * 0.72,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: -s * 0.12,
          width: s * 0.38,
          height: s * 0.22,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
