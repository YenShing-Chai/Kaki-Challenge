import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something broke</Text>
          <Text style={styles.body}>{this.state.error.message}</Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 14, color: '#555', textAlign: 'center' },
  button: { backgroundColor: '#111', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
