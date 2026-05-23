/**
 * Direction B — shared tab/screen primitives.
 *
 * Used by Home/Discover/Activity/Profile/Detail to keep the "Playful Buddy"
 * visual identity consistent across the whole app, not just the Create
 * wizard. Pure presentational — no API calls, no state.
 */

import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

// ─── Screen header: eyebrow + scribble-highlighted title ──────────────────

/**
 * One-line "eyebrow → big title" header used at the top of every tab.
 *
 * Examples:
 *   <ScreenHeader eyebrow="Today" before="3" highlight="active" />
 *   <ScreenHeader eyebrow="Discover" highlight="Browse" />
 *
 * The highlighted word gets the signature yellow scribble box (transform
 * rotate-1 for the hand-stamped feel).
 */
export function ScreenHeader({
  eyebrow,
  before,
  highlight,
  after,
  right,
  style,
}: {
  eyebrow?: string;
  before?: string;
  highlight: string;
  after?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.headerWrap, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={typeB.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[typeB.title, { marginTop: 2 }]}>
          {before ? `${before} ` : ''}
          <Text style={styles.highlight}>{highlight}</Text>
          {after ? ` ${after}` : ''}
        </Text>
      </View>
      {right}
    </View>
  );
}

// ─── Chunky offset card (paper bg, ink border, hard shadow) ───────────────

export function BCard({
  children,
  style,
  tint,
  large,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override the surface colour — defaults to paper. */
  tint?: string;
  /** Use the larger 4px offset shadow for hero cards. */
  large?: boolean;
  /** If supplied the whole card becomes pressable with a satisfying offset. */
  onPress?: () => void;
}) {
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    large ? shadowsB.cardLg : shadowsB.card,
    tint ? { backgroundColor: tint } : null,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 },
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

// ─── Hero card with orange offset (used for headline numbers) ─────────────

export function BHero({
  children,
  style,
  tint = colorsB.ink,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
}) {
  return (
    <View
      style={[
        styles.hero,
        { backgroundColor: tint },
        shadowsB.heroOrange,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Section: label + content stack ───────────────────────────────────────

export function BSection({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={typeB.eyebrow}>{title}</Text>
        {right}
      </View>
      <View style={{ gap: spacingB.md }}>{children}</View>
    </View>
  );
}

// ─── Static pill / badge ──────────────────────────────────────────────────

export function BPill({
  label,
  tone = 'neutral',
  size = 'md',
}: {
  label: string;
  tone?: 'neutral' | 'orange' | 'green' | 'yellow' | 'pink' | 'blue' | 'ink';
  size?: 'sm' | 'md';
}) {
  const palette: Record<typeof tone, { bg: string; fg: string }> = {
    neutral: { bg: colorsB.bgWarm, fg: colorsB.ink },
    orange: { bg: colorsB.orangeSoft, fg: colorsB.orangeDeep },
    green: { bg: colorsB.greenSoft, fg: colorsB.green },
    yellow: { bg: colorsB.yellow, fg: colorsB.ink },
    pink: { bg: colorsB.pinkSoft, fg: colorsB.ink },
    blue: { bg: colorsB.blueSoft, fg: colorsB.blue },
    ink: { bg: colorsB.ink, fg: colorsB.bgWarm },
  };
  const { bg, fg } = palette[tone];
  return (
    <View
      style={[
        styles.pill,
        size === 'sm' ? styles.pillSm : styles.pillMd,
        { backgroundColor: bg, borderColor: colorsB.ink },
      ]}
    >
      <Text style={[styles.pillText, { color: fg, fontSize: size === 'sm' ? 9 : 10 }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Stat tile (label + big value) ────────────────────────────────────────

export function BStat({
  label,
  value,
  tint,
  valueStyle,
}: {
  label: string;
  value: string;
  tint?: string;
  valueStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.stat, tint ? { backgroundColor: tint } : null]}>
      <Text style={[typeB.eyebrow, { fontSize: 9 }]}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>{value}</Text>
    </View>
  );
}

// ─── Settings row (label + value/control on the right) ────────────────────

export function BRow({
  label,
  value,
  onPress,
  right,
  danger,
  bold,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  bold?: boolean;
}) {
  const inner = (
    <>
      <Text
        style={[
          styles.rowLabel,
          danger && { color: colorsB.orangeDeep },
          bold && { fontWeight: '900' },
        ]}
      >
        {label}
      </Text>
      {right ?? (
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress ? <Text style={styles.chev}>›</Text> : null}
        </View>
      )}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.row}>{inner}</View>;
}

// ─── Solid button (smaller cousin of CtaButton, no offset shadow) ─────────

export function BButton({
  label,
  onPress,
  tone = 'orange',
  disabled,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'orange' | 'ink' | 'green' | 'paper';
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    orange: { bg: colorsB.orange, fg: colorsB.paper },
    ink: { bg: colorsB.ink, fg: colorsB.yellow },
    green: { bg: colorsB.green, fg: colorsB.paper },
    paper: { bg: colorsB.paper, fg: colorsB.ink },
  }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small ? styles.btnSm : styles.btnMd,
        { backgroundColor: palette.bg },
        shadowsB.card,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: palette.fg, fontSize: small ? 12 : 14 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Empty-state card ─────────────────────────────────────────────────────

export function BEmpty({
  emoji,
  title,
  body,
  cta,
}: {
  emoji?: string;
  title: string;
  body?: string;
  cta?: { label: string; onPress: () => void };
}) {
  return (
    <BCard style={{ alignItems: 'center', gap: spacingB.md, paddingVertical: spacingB.xxl }}>
      {emoji ? <Text style={{ fontSize: 34 }}>{emoji}</Text> : null}
      <Text style={[typeB.h2, { textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[typeB.lead, { textAlign: 'center', maxWidth: 260 }]}>{body}</Text>
      ) : null}
      {cta ? <BButton label={cta.label} onPress={cta.onPress} tone="orange" /> : null}
    </BCard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacingB.lg,
    marginTop: spacingB.md,
    marginBottom: spacingB.lg,
  },
  highlight: {
    backgroundColor: colorsB.yellow,
    color: colorsB.ink,
    paddingHorizontal: 6,
    borderRadius: 6,
    transform: [{ rotate: '-1deg' }],
  },

  card: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
  },

  hero: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.cardLg,
    padding: spacingB.xl,
  },

  section: { marginTop: spacingB.xl, gap: spacingB.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  pill: {
    borderWidth: 1.5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillSm: { paddingHorizontal: 6, paddingVertical: 1 },
  pillMd: { paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },

  stat: {
    flex: 1,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    padding: spacingB.md,
    gap: 2,
    alignItems: 'flex-start',
  },
  statValue: { fontSize: 18, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.3 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacingB.md,
    borderBottomWidth: 1,
    borderBottomColor: colorsB.line,
  },
  rowLabel: { fontSize: 14, fontWeight: '700', color: colorsB.ink, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacingB.sm },
  rowValue: { fontSize: 14, fontWeight: '700', color: colorsB.inkSoft },
  chev: { fontSize: 22, color: colorsB.inkFaint, fontWeight: '300' },

  btn: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: { paddingHorizontal: 12, paddingVertical: 8 },
  btnMd: { paddingHorizontal: 16, paddingVertical: 12 },
  btnText: { fontWeight: '900', letterSpacing: 0.3 },
});
