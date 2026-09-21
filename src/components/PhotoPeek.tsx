import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Avatar } from './Avatar';

type Props = {
  visible: boolean;
  uri?: string;
  name: string;
  onClose: () => void;
};

export function PhotoPeek({ visible, uri, name, onClose }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(visible);
  const size = Math.min(Dimensions.get('window').width * 0.74, 340);

  useEffect(() => {
    if (visible) setShown(true);
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      damping: 16,
      stiffness: 180,
      mass: 0.7,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setShown(false);
    });
  }, [visible, anim]);

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.fill} onPress={onClose}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dim,
            {
              opacity: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.82],
              }),
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.hero,
            {
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.28, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.ring, { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2 }]}>
            <Avatar name={name} uri={uri} size={size} />
          </View>
          <Text style={styles.caption}>{name}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0612',
  },
  hero: { alignItems: 'center', gap: 16 },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FF5E97',
    backgroundColor: '#16081F',
    shadowColor: '#FF5E97',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  caption: {
    color: '#F7F0F5',
    fontWeight: '800',
    fontSize: 18,
  },
});
