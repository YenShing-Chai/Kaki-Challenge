import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../lib/auth';
import { colors, radius, shadow } from '../../lib/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password) {
      setError('Email and password required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/(tabs)/discover');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <Text style={styles.brandEmoji}>🦘</Text>
            <Text style={styles.brand}>Kaki</Text>
            <Text style={styles.brandSub}>Buddy Challenges</Text>
            <Text style={styles.tagline}>Game on. With stakes.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.h1}>Welcome back</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Sign in</Text>
              )}
            </Pressable>

            <View style={styles.swap}>
              <Text style={styles.swapText}>New here? </Text>
              <Link href="/(auth)/sign-up" style={styles.swapLink}>
                Create an account
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.mint },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 24 },
  brandWrap: { alignItems: 'center', gap: 6 },
  brandEmoji: { fontSize: 56 },
  brand: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  brandSub: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  tagline: { color: colors.primaryDark, fontWeight: '600', marginTop: 2 },

  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.cardLg,
    padding: 22,
    gap: 14,
    ...shadow.hero,
  },
  h1: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.3, marginBottom: 4 },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMicro,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  error: { color: colors.danger, fontSize: 13 },
  swap: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  swapText: { color: colors.textMuted, fontSize: 13 },
  swapLink: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
