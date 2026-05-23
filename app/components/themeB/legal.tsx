/**
 * Direction B — shared chrome for long-form legal docs.
 *
 * Cream background, ink-bordered "draft" badge to make clear these are
 * pre-launch drafts that have not yet been reviewed by counsel, and chunky
 * section + paragraph primitives so the four policies share a system.
 */

import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colorsB, radiusB, spacingB, typeB } from '../../lib/themeB';

export function LegalScreen({
  title,
  lastUpdated,
  draft = true,
  children,
}: {
  title: string;
  lastUpdated: string;
  /** Show a "DRAFT — not reviewed by counsel" banner until #138 lands. */
  draft?: boolean;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {draft ? (
          <View style={styles.draftBanner}>
            <Text style={styles.draftEmoji}>⚖️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.draftTitle}>Pre-launch draft</Text>
              <Text style={styles.draftBody}>
                Not yet reviewed by counsel. Replace placeholders and have a lawyer sign off before
                shipping to the App Store / Play Store.
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.h1}>{title}</Text>
        <Text style={styles.meta}>Last updated {lastUpdated}</Text>

        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      <View style={{ gap: spacingB.sm }}>{children}</View>
    </View>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

/** Inline bold span. Use inside <P> to emphasise a phrase. */
export function Bold({ children }: { children: ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

export function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function Callout({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'warn' | 'note';
  children: ReactNode;
}) {
  const palette =
    tone === 'warn'
      ? { bg: colorsB.orangeSoft, border: colorsB.orangeDeep, fg: colorsB.orangeDeep }
      : tone === 'note'
        ? { bg: colorsB.greenSoft, border: colorsB.green, fg: colorsB.green }
        : { bg: colorsB.bgWarm, border: colorsB.ink, fg: colorsB.ink };
  return (
    <View
      style={[
        styles.callout,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.calloutText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

/** Inline highlight used for terms that still need lawyer/jurisdiction input. */
export function Placeholder({ children }: { children: ReactNode }) {
  return <Text style={styles.placeholder}>[{children}]</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  scroll: { padding: spacingB.xl, paddingBottom: 60, gap: spacingB.md },

  // Draft banner
  draftBanner: {
    flexDirection: 'row',
    gap: spacingB.md,
    padding: spacingB.lg,
    backgroundColor: colorsB.yellow,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
  },
  draftEmoji: { fontSize: 22 },
  draftTitle: { fontSize: 13, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.2 },
  draftBody: {
    fontSize: 11,
    color: colorsB.ink,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 2,
  },

  // Document
  h1: {
    fontSize: 28,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.6,
    marginTop: spacingB.md,
  },
  meta: {
    color: colorsB.inkFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  section: { gap: spacingB.sm, marginTop: spacingB.md },
  h2: {
    fontSize: 17,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.3,
    marginTop: spacingB.sm,
  },
  p: {
    fontSize: 14,
    color: colorsB.ink,
    lineHeight: 21,
    fontWeight: '500',
  },
  bold: { fontWeight: '900' },

  // Bullets
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletDot: { fontSize: 14, color: colorsB.orange, fontWeight: '900', lineHeight: 21 },
  bulletText: { flex: 1, fontSize: 14, color: colorsB.ink, lineHeight: 21, fontWeight: '500' },

  // Callout
  callout: {
    borderWidth: 2,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
    marginTop: spacingB.sm,
  },
  calloutText: { fontSize: 13, fontWeight: '700', lineHeight: 19 },

  // Placeholder highlight
  placeholder: {
    backgroundColor: colorsB.yellow,
    color: colorsB.ink,
    fontWeight: '900',
    paddingHorizontal: 4,
  },
});
