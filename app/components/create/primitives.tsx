/**
 * Direction B — shared wizard primitives.
 *
 * Each create-challenge step uses these so the visual language stays
 * locked across the whole 8-step flow. Pure presentational — no API
 * calls, no state machinery.
 */

import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

// ─── Top nav (back · progress · counter) ──────────────────────────────────

export function TopNav({
  step,
  total,
  onBack,
  rightPill,
  isClose,
}: {
  step: number; // 1-indexed
  total: number;
  onBack: () => void;
  rightPill?: ReactNode;
  isClose?: boolean;
}) {
  return (
    <View style={styles.topNav}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isClose ? 'Close' : 'Back'}
        onPress={onBack}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.backBtnText}>{isClose ? '✕' : '←'}</Text>
      </Pressable>
      <View style={styles.progressRow}>
        {Array.from({ length: total }).map((_, i) => {
          const isDone = i < step - 1;
          const isNow = i === step - 1;
          return (
            <View
              key={i}
              style={[
                styles.progressSeg,
                isDone && { backgroundColor: colorsB.green },
                isNow && { backgroundColor: colorsB.orange },
              ]}
            />
          );
        })}
      </View>
      {rightPill ?? (
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>
            {step} / {total}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Title with yellow scribble highlight on key word ─────────────────────

export function Title({
  before,
  highlight,
  after,
}: {
  before: string;
  highlight: string;
  after?: string;
}) {
  return (
    <View style={styles.titleWrap}>
      <Text style={typeB.title}>
        {before}
        {before && ' '}
        <Text style={styles.highlightText}>{highlight}</Text>
        {after ? ` ${after}` : ''}
      </Text>
    </View>
  );
}

// ─── Lead (subtitle below title) ──────────────────────────────────────────

export function Lead({ children }: { children: ReactNode }) {
  return <Text style={[typeB.lead, { marginBottom: spacingB.xl, marginTop: spacingB.sm }]}>{children}</Text>;
}

// ─── CTA button (chunky orange offset shadow) ─────────────────────────────

export function CtaButton({
  label,
  onPress,
  disabled,
  variant = 'ink',
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'ink' | 'orange' | 'green';
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.cta,
        variant === 'ink' && styles.ctaInk,
        variant === 'orange' && styles.ctaOrange,
        variant === 'green' && styles.ctaGreen,
        (disabled || loading) && styles.ctaDisabled,
        pressed && !disabled && !loading && styles.ctaPressed,
      ]}
    >
      <Text
        style={[
          styles.ctaText,
          variant === 'ink' && { color: colorsB.yellow },
          variant === 'orange' && { color: colorsB.paper },
          variant === 'green' && { color: colorsB.paper },
        ]}
      >
        {loading ? '...' : label}
      </Text>
    </Pressable>
  );
}

// ─── Secondary text link (e.g. "save as draft") ───────────────────────────

export function SecondaryLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', marginTop: spacingB.md }}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

// ─── Generic chunky card (paper bg, ink border, hard shadow) ─────────────

export function Card({ children, style, active }: { children: ReactNode; style?: StyleProp<ViewStyle>; active?: boolean }) {
  return (
    <View style={[styles.card, active && styles.cardActive, style]}>{children}</View>
  );
}

// ─── Selectable tile (used in 1-up lists) ─────────────────────────────────

export function SelectableTile({
  active,
  onPress,
  children,
  style,
  disabled,
}: {
  active?: boolean;
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        active && styles.tileActive,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { transform: [{ translateX: 1 }, { translateY: 1 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

// ─── Body scroll container ────────────────────────────────────────────────

export function BodyScroll({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, paddingHorizontal: spacingB.lg }}>{children}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingB.lg,
    paddingVertical: spacingB.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '900', color: colorsB.ink },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: spacingB.lg,
  },
  progressSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(28,20,16,0.12)',
  },
  counterPill: {
    backgroundColor: colorsB.ink,
    paddingHorizontal: spacingB.md,
    paddingVertical: 5,
    borderRadius: 100,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '800',
    color: colorsB.bgWarm,
    letterSpacing: 0.3,
  },
  titleWrap: { paddingHorizontal: spacingB.lg, marginTop: spacingB.sm },
  highlightText: {
    backgroundColor: colorsB.yellow,
    paddingHorizontal: 6,
    color: colorsB.ink,
    borderRadius: 6,
    // Slight tilt — RN doesn't render :after pseudo elements so we tilt the
    // span itself for a similar handmade feel.
    transform: [{ rotate: '-1deg' }],
  },
  cta: {
    marginTop: spacingB.lg,
    marginHorizontal: spacingB.lg,
    padding: 14,
    borderRadius: radiusB.card,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaInk: {
    backgroundColor: colorsB.ink,
    ...shadowsB.heroOrange,
  },
  ctaOrange: {
    backgroundColor: colorsB.orange,
    ...shadowsB.cardLg,
  },
  ctaGreen: {
    backgroundColor: colorsB.green,
    ...shadowsB.cardLg,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaPressed: { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 },
  ctaText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colorsB.inkSoft,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
    ...shadowsB.card,
  },
  cardActive: { backgroundColor: colorsB.greenSoft },
  tile: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.bubble,
    padding: spacingB.lg,
    marginBottom: spacingB.md,
    ...shadowsB.card,
  },
  tileActive: {
    backgroundColor: colorsB.orange,
    borderColor: colorsB.ink,
  },
});
