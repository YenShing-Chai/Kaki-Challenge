/**
 * Direction B — Winner Pool sub-steps.
 *
 * Branches from main Step 6 when reward = WINNER_POOL:
 *   6a — Entry contribution amount
 *   6b — Distribution method
 *   6c — Terms acceptance
 *
 * After 6c the flow rejoins the main wizard at Step 7 (Schedule).
 */

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';
import type { DistributionMethodB, WizardState } from './state';

type Update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
type Props = { state: WizardState; update: Update };

const MIN_ENTRY = 1;
const MAX_ENTRY = 50;
const MAX_POOL = 500;
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 20;
const PRESETS = [1, 5, 10, 25, 50];

// ════════════════════════════════════════════════════════════════════════
// STEP 6a — Entry contribution
// ════════════════════════════════════════════════════════════════════════

export function Step6aContribution({ state, update }: Props) {
  const amount = state.entryContributionAmount;
  const maxPool = amount * state.participantMaximum;
  const overCap = maxPool > MAX_POOL;
  const atOrAboveCap = amount >= MAX_ENTRY;

  function step(by: number) {
    const next = Math.max(MIN_ENTRY, Math.min(MAX_ENTRY, amount + by));
    update('entryContributionAmount', next);
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacingB.xl }}>
      {/* Hero amount */}
      <View style={s.moneyHero}>
        <Text style={s.heroLabel}>Entry per person</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
          <Text style={s.heroCurrency}>RM</Text>
          <Text style={s.heroValue}>{amount}</Text>
        </View>
        <View style={s.steppers}>
          <Pressable onPress={() => step(-1)} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}>
            <Text style={s.stepBtnText}>−</Text>
          </Pressable>
          <Pressable onPress={() => step(1)} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}>
            <Text style={s.stepBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Preset chips */}
      <View style={s.presetRow}>
        {PRESETS.map((v) => {
          const active = amount === v;
          const isCap = v === MAX_ENTRY;
          return (
            <Pressable
              key={v}
              onPress={() => update('entryContributionAmount', v)}
              style={[
                s.presetChip,
                active && s.presetChipActive,
                isCap && !active && s.presetChipCap,
              ]}
            >
              <Text style={[s.presetText, active && { color: colorsB.paper }]}>RM {v}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Pool projection */}
      <View style={s.projectionCard}>
        <Text style={s.projLabel}>Estimated total pool</Text>
        <Text style={s.projValue}>Up to RM {Math.min(maxPool, MAX_POOL)}</Text>
        <Text style={s.projSub}>
          {state.participantMaximum} friends × RM {amount} entry · max {MAX_PARTICIPANTS} people
        </Text>
      </View>

      {/* Warning */}
      {(atOrAboveCap || overCap) && (
        <View style={s.warnCallout}>
          <Text style={{ fontSize: 14 }}>⚠️</Text>
          <Text style={s.warnText}>
            {overCap
              ? `Total pool would exceed RM ${MAX_POOL}. Lower entry or participant cap.`
              : `RM ${MAX_ENTRY} max per person in MVP. Higher buy-ins need legal approval.`}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 6b — Distribution method
// ════════════════════════════════════════════════════════════════════════

const DISTRIBUTION_OPTIONS: Array<{
  method: DistributionMethodB;
  emoji: string;
  name: string;
  desc: string;
  example: string;
  recommended?: boolean;
}> = [
  {
    method: 'ALL_COMPLETERS_EQUAL_SPLIT',
    emoji: '🤝',
    name: 'All Completers Split',
    desc: 'Everyone who finishes gets equal share.',
    example: '5 of 8 finish → RM 16 each',
    recommended: true,
  },
  {
    method: 'TOP_N_EQUAL_SPLIT',
    emoji: '🏆',
    name: 'Top N Winners',
    desc: 'Only the top N split it.',
    example: 'Top 3 → RM 26 each',
  },
  {
    method: 'RANKED_PERCENTAGE',
    emoji: '🥇',
    name: 'Ranked %',
    desc: '1st 50%, 2nd 30%, 3rd 20%.',
    example: 'RM 40 / RM 24 / RM 16',
  },
  {
    method: 'PROPORTIONAL',
    emoji: '📊',
    name: 'Proportional',
    desc: 'Higher verified score = bigger share.',
    example: 'Score 30 of 50 → 60% of pool',
  },
  {
    method: 'TEAM_SPLIT',
    emoji: '🤜',
    name: 'Team Split',
    desc: 'Winning team splits the pool equally.',
    example: '2 teams of 2 → RM 25 each member',
  },
];

export function Step6bDistribution({ state, update }: Props) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacingB.xl }}>
      {DISTRIBUTION_OPTIONS.map((opt) => {
        const active = state.distributionMethod === opt.method;
        return (
          <Pressable
            key={opt.method}
            onPress={() => update('distributionMethod', opt.method)}
            style={({ pressed }) => [
              s.distCard,
              active && s.distCardActive,
              pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
            ]}
          >
            {opt.recommended && (
              <View style={s.recSticker}>
                <Text style={s.recStickerText}>✨ SAFEST</Text>
              </View>
            )}
            <View style={s.distEmojiBox}>
              <Text style={{ fontSize: 19 }}>{opt.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.distName}>{opt.name}</Text>
              <Text style={s.distDesc}>{opt.desc}</Text>
              <View style={s.exampleBadge}>
                <Text style={s.exampleText}>{opt.example}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 6c — Terms acceptance
// ════════════════════════════════════════════════════════════════════════

export function Step6cTerms({ state, update }: Props) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacingB.xl }}>
      {/* Private-only banner */}
      <View style={s.termsBanner}>
        <View style={s.tbIcon}>
          <Text style={{ fontSize: 16 }}>🔒</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.tbMsg}>Private / invite-only</Text>
          <Text style={s.tbSub}>Public cash pools coming in Phase 2</Text>
        </View>
      </View>

      {/* Terms bullet list */}
      <View style={s.termsList}>
        <Text style={s.termsHead}>What you're agreeing to</Text>
        <Bullet>
          Money <Strong>held by Stripe</Strong> until challenge ends
        </Bullet>
        <Bullet>Kaki admins review every pool before it goes live</Bullet>
        <Bullet>
          <Strong>24h dispute window</Strong> after results
        </Bullet>
        <Bullet>Payout 1–3 days after dispute closes</Bullet>
        <Bullet>Full refund if you cancel before start</Bullet>
        <Bullet>No cancel after the challenge starts</Bullet>
      </View>

      {/* Two checkboxes */}
      <CheckRow
        checked={state.termsAccepted}
        onPress={() => update('termsAccepted', !state.termsAccepted)}
        text="I've read Kaki's"
        bold="Winner Pool Terms"
        small="Terms · Refund · Dispute policy"
      />
      <CheckRow
        checked={state.ageVerified}
        onPress={() => update('ageVerified', !state.ageVerified)}
        text="I'm 18+ and not in a restricted region"
        small="Malaysia · Singapore · most of SEA OK"
      />
    </ScrollView>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontWeight: '900' }}>{children}</Text>;
}

function CheckRow({
  checked,
  onPress,
  text,
  bold,
  small,
}: {
  checked: boolean;
  onPress: () => void;
  text: string;
  bold?: string;
  small?: string;
}) {
  return (
    <Pressable onPress={onPress} style={s.checkRow}>
      <View style={[s.checkBox, checked && s.checkBoxChecked]}>
        {checked && <Text style={s.checkMark}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.checkText}>
          {text}
          {bold && <> <Text style={{ fontWeight: '900' }}>{bold}</Text></>}
        </Text>
        {small && <Text style={s.checkSmall}>{small}</Text>}
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  // 6a — Money hero
  moneyHero: {
    backgroundColor: colorsB.paper,
    borderWidth: 2.5,
    borderColor: colorsB.ink,
    borderRadius: 20,
    padding: 18,
    marginBottom: spacingB.md,
    alignItems: 'center',
    ...shadowsB.heroOrange,
  },
  heroLabel: {
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colorsB.inkSoft,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroCurrency: {
    fontSize: 22,
    color: colorsB.inkSoft,
    fontWeight: '800',
    marginRight: 6,
  },
  heroValue: {
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 58,
    color: colorsB.ink,
  },
  steppers: { flexDirection: 'row', gap: 14, marginTop: 10 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colorsB.paper, fontSize: 18, fontWeight: '900' },

  presetRow: { flexDirection: 'row', gap: 6, marginBottom: spacingB.md },
  presetChip: {
    flex: 1,
    paddingVertical: 9,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 100,
    alignItems: 'center',
    ...shadowsB.card,
  },
  presetChipActive: { backgroundColor: colorsB.orange },
  presetChipCap: { backgroundColor: colorsB.pinkSoft },
  presetText: { fontSize: 11, fontWeight: '800', color: colorsB.ink },

  projectionCard: {
    backgroundColor: colorsB.greenSoft,
    borderWidth: 2,
    borderColor: colorsB.green,
    borderRadius: 14,
    padding: 14,
    marginBottom: spacingB.md,
    shadowColor: colorsB.green,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  projLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2a4a28',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  projValue: { fontSize: 22, fontWeight: '900', color: '#1f3a1d', letterSpacing: -0.5 },
  projSub: { fontSize: 11, color: '#2a4a28', fontWeight: '600', marginTop: 2 },

  warnCallout: {
    backgroundColor: colorsB.orangeSoft,
    borderWidth: 2,
    borderColor: colorsB.orange,
    borderRadius: 12,
    padding: 11,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  warnText: { fontSize: 11, color: colorsB.orangeDeep, fontWeight: '700', lineHeight: 15, flex: 1 },

  // 6b — Distribution
  distCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 16,
    marginBottom: 9,
    position: 'relative',
    ...shadowsB.card,
  },
  distCardActive: { backgroundColor: colorsB.greenSoft, borderColor: colorsB.green },
  recSticker: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: colorsB.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colorsB.ink,
    transform: [{ rotate: '2deg' }],
  },
  recStickerText: { fontSize: 9, fontWeight: '900', color: colorsB.paper, letterSpacing: 0.5 },
  distEmojiBox: {
    width: 38,
    height: 38,
    backgroundColor: colorsB.yellow,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distName: { fontSize: 14, fontWeight: '900', color: colorsB.ink },
  distDesc: { fontSize: 10.5, fontWeight: '600', color: colorsB.inkSoft, marginTop: 3, lineHeight: 14 },
  exampleBadge: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colorsB.ink,
    borderRadius: 8,
  },
  exampleText: { fontSize: 10, fontWeight: '800', color: colorsB.bgWarm },

  // 6c — Terms
  termsBanner: {
    backgroundColor: colorsB.orange,
    borderWidth: 2.5,
    borderColor: colorsB.ink,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    ...shadowsB.card,
  },
  tbIcon: {
    width: 32,
    height: 32,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tbMsg: { fontSize: 12, fontWeight: '900', color: colorsB.paper, lineHeight: 14 },
  tbSub: { fontSize: 10.5, fontWeight: '600', color: colorsB.orangeSoft, marginTop: 2 },

  termsList: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...shadowsB.card,
  },
  termsHead: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colorsB.inkSoft,
    marginBottom: 8,
  },
  bulletRow: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  bulletDot: { color: colorsB.orange, fontWeight: '900', fontSize: 14, lineHeight: 16 },
  bulletText: { fontSize: 11, fontWeight: '600', color: colorsB.ink, flex: 1, lineHeight: 16 },

  checkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 12,
    marginBottom: 8,
    ...shadowsB.card,
  },
  checkBox: {
    width: 22,
    height: 22,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: { backgroundColor: colorsB.green, borderColor: colorsB.green },
  checkMark: { color: colorsB.paper, fontSize: 13, fontWeight: '900' },
  checkText: { fontSize: 11.5, fontWeight: '700', color: colorsB.ink, lineHeight: 16 },
  checkSmall: { fontSize: 10, fontWeight: '600', color: colorsB.inkSoft, marginTop: 1 },
});
