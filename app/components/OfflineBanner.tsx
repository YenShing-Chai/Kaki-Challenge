import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Top-of-app banner that warns when the device has no network at all.
 *
 * Note: we deliberately do NOT key off `isInternetReachable` — that flag goes
 * false on shared wifi / captive-portal networks even when our dev API is
 * perfectly reachable over LAN. Only `isConnected === false` (no network at
 * all) triggers the banner.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    });
    return () => sub();
  }, []);

  if (online) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⚠️ You're offline — we'll catch up when you're back</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#7c2d12',
    paddingVertical: 8,
    alignItems: 'center',
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
