/**
 * Direction B — Create Challenge step components.
 *
 * Each StepN takes the shared { state, update } from the parent wizard
 * and renders its screen body. The parent owns top-nav + CTA — these
 * components only render the body content between them.
 */

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  categoryV2Emoji,
  categoryV2Label,
  colorsB,
  intentMeta,
  radiusB,
  shadowsB,
  spacingB,
  typeB,
  type CategoryV2Key,
  type CreatorIntentKey,
} from '../../lib/themeB';
import type { WizardState } from './state';

type Update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
type Props = { state: WizardState; update: Update };

// ════════════════════════════════════════════════════════════════════════
// STEP 1 — Creator intent
// ════════════════════════════════════════════════════════════════════════

const INTENT_ORDER: CreatorIntentKey[] = [
  'PERSONAL',
  'FRIENDS',
  'WORKPLACE',
  'MERCHANT',
  'EVENT',
  'COMMUNITY',
];

export function Step1Intent({ state, update }: Props) {
  return (
    <ScrollView contentContainerStyle={s.scrollPad}>
      <View style={s.intentGrid}>
        {INTENT_ORDER.map((key) => {
          const meta = intentMeta[key];
          const active = state.creatorIntent === key;
          return (
            <Pressable
              key={key}
              onPress={() => update('creatorIntent', key)}
              style={({ pressed }) => [
                s.intentBub,
                active && s.intentBubActive,
                pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
              ]}
            >
              <View
                style={[
                  s.emojiCircle,
                  active && { backgroundColor: colorsB.yellow },
                ]}
              >
                <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
              </View>
              <Text
                style={[
                  s.intentName,
                  active && { color: colorsB.paper },
                ]}
              >
                {meta.label}
              </Text>
              <Text
                style={[
                  s.intentSub,
                  active && { color: colorsB.orangeSoft },
                ]}
              >
                {meta.sub}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 2 — Category
// ════════════════════════════════════════════════════════════════════════

const CATEGORY_ORDER: CategoryV2Key[] = [
  'HABIT',
  'FITNESS',
  'MONEY',
  'LEARNING',
  'WORK',
  'SOCIAL',
  'TRAVEL',
  'FOOD',
  'RETAIL',
  'CREATIVE',
  'COMMUNITY',
  'EVENT',
  'CUSTOM',
];

export function Step2Category({ state, update }: Props) {
  return (
    <ScrollView contentContainerStyle={s.scrollPad}>
      <View style={s.chipCloud}>
        {CATEGORY_ORDER.map((key) => {
          const active = state.category === key;
          return (
            <Pressable
              key={key}
              onPress={() => update('category', key)}
              style={({ pressed }) => [
                s.chip,
                active && s.chipActive,
                pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
              ]}
            >
              <Text style={{ fontSize: 12 }}>{categoryV2Emoji[key]}</Text>
              <Text style={[s.chipText, active && { color: colorsB.bgWarm }]}>
                {categoryV2Label[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {state.category && (
        <View style={s.hint}>
          <Text style={s.hintText}>
            💡 <Text style={{ fontWeight: '900' }}>{categoryV2Label[state.category]}</Text>{' '}
            templates: streaks, targets &amp; more.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 3 — Template / win condition
// ════════════════════════════════════════════════════════════════════════

const TEMPLATES: Array<{
  win: WizardState['winCondition'];
  emoji: string;
  name: string;
  desc: string;
}> = [
  { win: 'REACH_TARGET', emoji: '🔥', name: 'Daily streak', desc: 'Hit the target every single day. Miss one = streak resets.' },
  { win: 'COMPLETE_MINIMUM', emoji: '✅', name: 'Complete tasks', desc: 'Finish a list of tasks before the deadline.' },
  { win: 'STAY_BELOW_LIMIT', emoji: '🛑', name: 'Stay under', desc: 'Keep something below a ceiling — spend, screen time…' },
  { win: 'RANK_TOP_N', emoji: '🏆', name: 'Top N winners', desc: 'Highest score wins. Top N split it.' },
  { win: 'JUDGED_BEST', emoji: '🎨', name: 'Best submission', desc: 'Everyone posts. Group picks the winner.' },
];

export function Step3Template({ state, update }: Props) {
  return (
    <ScrollView contentContainerStyle={s.scrollPad}>
      {TEMPLATES.map((t) => {
        const active = state.winCondition === t.win;
        return (
          <Pressable
            key={t.win ?? 'none'}
            onPress={() => update('winCondition', t.win)}
            style={({ pressed }) => [
              s.templCard,
              active && s.templCardActive,
              pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
            ]}
          >
            <View style={s.templEmojiBox}>
              <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.templName}>{t.name}</Text>
              <Text style={s.templDesc}>{t.desc}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 4 — Target / numeric inputs
// ════════════════════════════════════════════════════════════════════════

const STEP_PRESETS = [5000, 8000, 10000, 15000];

export function Step4Rules({ state, update }: Props) {
  const isStreak =
    state.winCondition === 'REACH_TARGET' || state.winCondition === 'COMPLETE_ALL';

  function stepperBtn(label: '+' | '−', onPress: () => void) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}>
        <Text style={s.stepBtnText}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scrollPad}>
      {/* Title input */}
      <View style={s.inputBox}>
        <Text style={s.inputLabel}>Challenge title</Text>
        <TextInput
          value={state.title}
          onChangeText={(v) => update('title', v)}
          placeholder="e.g. Family step streak"
          placeholderTextColor={colorsB.inkFaint}
          style={s.input}
        />
      </View>

      {/* Big target hero */}
      <View style={s.moneyHero}>
        <Text style={s.heroLabel}>Daily target</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
          <Text style={s.heroValue}>{state.targetValue.toLocaleString()}</Text>
          <Text style={s.heroUnit}>{state.metricType === 'STEPS' ? 'steps' : ''}</Text>
        </View>
        <View style={s.heroSteppers}>
          {stepperBtn('−', () => update('targetValue', Math.max(1000, state.targetValue - 1000)))}
          {stepperBtn('+', () => update('targetValue', state.targetValue + 1000))}
        </View>
      </View>

      {/* Preset chips */}
      <View style={s.presetRow}>
        {STEP_PRESETS.map((v) => {
          const active = state.targetValue === v;
          return (
            <Pressable
              key={v}
              onPress={() => update('targetValue', v)}
              style={[s.presetChip, active && s.presetChipActive]}
            >
              <Text style={[s.presetText, active && { color: colorsB.paper }]}>
                {v.toLocaleString()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Days + misses */}
      {isStreak && (
        <View style={s.doubleRow}>
          <View style={s.miniBox}>
            <Text style={s.miniLabel}>Days</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {stepperBtn('−', () => update('requiredCount', Math.max(1, state.requiredCount - 1)))}
              <Text style={s.miniValue}>{state.requiredCount}</Text>
              {stepperBtn('+', () => update('requiredCount', state.requiredCount + 1))}
            </View>
          </View>
          <View style={s.miniBox}>
            <Text style={s.miniLabel}>Free skips</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {stepperBtn('−', () => update('allowedMisses', Math.max(0, state.allowedMisses - 1)))}
              <Text style={s.miniValue}>{state.allowedMisses}</Text>
              {stepperBtn('+', () => update('allowedMisses', state.allowedMisses + 1))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 5 — Verification
// ════════════════════════════════════════════════════════════════════════

const VERIFICATION_OPTIONS: Array<{
  level: WizardState['verification'];
  emoji: string;
  name: string;
  desc: string;
  strength: number; // 1-5 bars
}> = [
  { level: 'SELF_DECLARATION', emoji: '🤞', name: 'Honor system', desc: 'Just check the box.', strength: 1 },
  { level: 'PHOTO_UPLOAD', emoji: '📸', name: 'Daily photo', desc: 'Snap proof each day.', strength: 2 },
  { level: 'PEER_VERIFICATION', emoji: '👍', name: 'Friends approve', desc: '2 friends confirm daily.', strength: 3 },
  { level: 'ORGANIZER_APPROVAL', emoji: '🧑‍⚖️', name: 'Organizer approves', desc: 'Admin signs off.', strength: 4 },
  { level: 'QR_LOCATION', emoji: '📍', name: 'QR / location', desc: 'Scan at the place.', strength: 4 },
  { level: 'RECEIPT_POS_API', emoji: '⌚', name: 'Auto from device', desc: 'Apple Health / receipts.', strength: 5 },
];

export function Step5Verification({ state, update }: Props) {
  return (
    <ScrollView contentContainerStyle={s.scrollPad}>
      {VERIFICATION_OPTIONS.map((v) => {
        const active = state.verification === v.level;
        return (
          <Pressable
            key={v.level ?? 'none'}
            onPress={() => update('verification', v.level)}
            style={({ pressed }) => [
              s.vTile,
              active && s.vTileActive,
              pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
            ]}
          >
            <View
              style={[
                s.vIcon,
                active && { backgroundColor: colorsB.yellow },
              ]}
            >
              <Text style={{ fontSize: 14 }}>{v.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.vName, active && { color: colorsB.paper }]}>{v.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        s.strengthBar,
                        i < v.strength && {
                          backgroundColor: active ? colorsB.yellow : colorsB.orange,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[s.vDesc, active && { color: colorsB.orangeSoft }]}>{v.desc}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 6 — Reward
// ════════════════════════════════════════════════════════════════════════

const REWARD_OPTIONS: Array<{
  type: WizardState['reward'];
  emoji: string;
  name: string;
  desc: string;
  bg: string;
}> = [
  { type: 'NONE', emoji: '🤐', name: 'Nothing', desc: 'Brag-rights only.', bg: colorsB.greenSoft },
  { type: 'BADGE', emoji: '🏅', name: 'Custom badge', desc: 'Pin a winner-badge on your profile.', bg: colorsB.yellow },
  { type: 'POINTS', emoji: '⭐', name: 'Kaki points', desc: 'Trade for swag &amp; perks.', bg: colorsB.pinkSoft },
  { type: 'VOUCHER', emoji: '🎟', name: 'Voucher', desc: 'Merchant or sponsor gift.', bg: colorsB.blueSoft },
  { type: 'WINNER_POOL', emoji: '💸', name: 'Cash pool', desc: 'Real stakes · private only · admin review.', bg: colorsB.bgWarm },
];

export function Step6Reward({ state, update }: Props) {
  return (
    <ScrollView contentContainerStyle={s.scrollPad}>
      {REWARD_OPTIONS.map((r) => {
        const active = state.reward === r.type;
        return (
          <Pressable
            key={r.type ?? 'none'}
            onPress={() => update('reward', r.type)}
            style={({ pressed }) => [
              s.rCard,
              active && s.rCardActive,
              pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
            ]}
          >
            <View style={[s.rEmoji, { backgroundColor: active ? colorsB.yellow : r.bg }]}>
              <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rName, active && { color: colorsB.paper }]}>{r.name}</Text>
              <Text style={[s.rDesc, active && { color: colorsB.orangeSoft }]}>{r.desc}</Text>
            </View>
            {r.type === 'WINNER_POOL' && (
              <View style={s.badgePill}>
                <Text style={s.badgePillText}>NEW</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 7 — Schedule + visibility
// ════════════════════════════════════════════════════════════════════════

export function Step7Schedule({ state, update }: Props) {
  function bumpDuration(by: number) {
    const next = Math.max(1, state.durationDays + by);
    update('durationDays', next);
    // Recompute endAt from startAt + duration
    if (state.startAt) {
      const start = new Date(state.startAt);
      const end = new Date(start);
      end.setDate(end.getDate() + next);
      update('endAt', end.toISOString().slice(0, 10));
    }
  }

  return (
    <ScrollView contentContainerStyle={s.scrollPad}>
      <View style={s.calCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '800' }}>📅 STARTS</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colorsB.inkSoft }}>tap to change</Text>
        </View>
        <Text style={s.calRange}>{formatRange(state.startAt, state.endAt)}</Text>
        <Text style={s.calSub}>{state.durationDays} days</Text>
      </View>

      <View style={s.doubleRow}>
        <Pressable onPress={() => bumpDuration(-1)} style={s.miniBox}>
          <Text style={s.miniLabel}>− 1 day</Text>
        </Pressable>
        <Pressable onPress={() => bumpDuration(1)} style={s.miniBox}>
          <Text style={s.miniLabel}>+ 1 day</Text>
        </Pressable>
        <Pressable onPress={() => bumpDuration(7)} style={s.miniBox}>
          <Text style={s.miniLabel}>+ 1 week</Text>
        </Pressable>
      </View>

      <Text style={{ ...typeB.label, marginTop: spacingB.xl, marginBottom: 8, color: colorsB.inkSoft, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        Visibility
      </Text>
      <View style={s.visRow}>
        {(['PRIVATE', 'GROUP', 'PUBLIC'] as const).map((v) => {
          const active = state.visibility === v;
          const label = v === 'PRIVATE' ? '🔒 Invite' : v === 'GROUP' ? '👥 Group' : '🌍 Public';
          return (
            <Pressable
              key={v}
              onPress={() => update('visibility', v)}
              style={[s.visPill, active && s.visPillActive]}
            >
              <Text style={[s.visPillText, active && { color: colorsB.paper }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STEP 8 — Review
// ════════════════════════════════════════════════════════════════════════

export function Step8Review({ state }: { state: WizardState }) {
  const isWP = state.reward === 'WINNER_POOL';
  return (
    <ScrollView contentContainerStyle={s.scrollPad}>
      <View style={[s.heroSummary, isWP && { backgroundColor: colorsB.orange }]}>
        <Text style={s.hsTag}>YOUR CHALLENGE</Text>
        <Text style={s.hsTitle}>{state.title || 'Untitled challenge'}</Text>
        <View style={s.hsMetaRow}>
          {state.creatorIntent && <Pill text={intentMeta[state.creatorIntent].label} />}
          {state.category && <Pill text={categoryV2Label[state.category]} />}
          <Pill text={`${state.targetValue.toLocaleString()} × ${state.requiredCount}d`} />
          {state.verification && <Pill text={shortVerification(state.verification)} />}
          <Pill text={shortReward(state.reward)} />
        </View>
      </View>

      <View style={s.breakdown}>
        <Row k="Starts" v={formatDate(state.startAt)} />
        <Row k="Ends" v={formatDate(state.endAt)} />
        <Row k="Visibility" v={state.visibility} />
        <Row k="Dispute window" v="24 hrs" />
      </View>

      <View style={s.riskBanner}>
        <View style={s.checkIcon}>
          <Text style={{ color: colorsB.paper, fontWeight: '900' }}>✓</Text>
        </View>
        <View style={{ flex: 1 }}>
          {isWP ? (
            <Text style={s.riskText}>
              <Text style={{ fontWeight: '900' }}>Pending admin review.</Text>
              {' '}WP challenges go through manual approval (usually under 2 hours).
            </Text>
          ) : (
            <Text style={s.riskText}>
              <Text style={{ fontWeight: '900' }}>All clear.</Text> Safe to publish — auto-approved.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View style={s.hsPill}>
      <Text style={s.hsPillText}>{text}</Text>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.brRow}>
      <Text style={s.brKey}>{k}</Text>
      <Text style={s.brVal}>{v}</Text>
    </View>
  );
}

function formatRange(start: string, end: string): string {
  if (!start || !end) return '—';
  return `${formatDate(start)} → ${formatDate(end)}`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

function shortVerification(v: WizardState['verification']): string {
  switch (v) {
    case 'SELF_DECLARATION': return '🤞 Self';
    case 'PHOTO_UPLOAD': return '📸 Photo';
    case 'PEER_VERIFICATION': return '👍 Peer';
    case 'ORGANIZER_APPROVAL': return '🧑‍⚖️ Admin';
    case 'QR_LOCATION': return '📍 QR';
    case 'RECEIPT_POS_API': return '⌚ Auto';
    case 'PARTNER_VERIFIED': return '🤝 Partner';
    default: return '—';
  }
}

function shortReward(r: WizardState['reward']): string {
  switch (r) {
    case 'NONE': return '🤐 None';
    case 'BADGE': return '🏅 Badge';
    case 'POINTS': return '⭐ Points';
    case 'VOUCHER': return '🎟 Voucher';
    case 'DISCOUNT_FREE_ITEM': return '🎁 Discount';
    case 'WINNER_POOL': return '💸 Cash pool';
    default: return '—';
  }
}

// ════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  scrollPad: {
    paddingBottom: spacingB.xl,
  },
  // Step 1
  intentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  intentBub: {
    width: '48%',
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.bubble,
    padding: spacingB.lg,
    ...shadowsB.card,
  },
  intentBubActive: {
    backgroundColor: colorsB.orange,
  },
  emojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsB.greenSoft,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  intentName: { fontSize: 13, fontWeight: '900', color: colorsB.ink },
  intentSub: { fontSize: 10.5, fontWeight: '600', color: colorsB.inkSoft, marginTop: 2 },

  // Step 2
  chipCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...shadowsB.card,
  },
  chipActive: { backgroundColor: colorsB.ink },
  chipText: { fontSize: 12, fontWeight: '700', color: colorsB.ink },
  hint: {
    marginTop: spacingB.lg,
    backgroundColor: colorsB.greenSoft,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colorsB.green,
    borderRadius: 12,
    padding: 11,
  },
  hintText: { fontSize: 11, fontWeight: '600', color: '#2a4a28' },

  // Step 3
  templCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 16,
    marginBottom: 9,
    ...shadowsB.card,
  },
  templCardActive: { backgroundColor: colorsB.greenSoft },
  templEmojiBox: {
    width: 44,
    height: 44,
    backgroundColor: colorsB.orangeSoft,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templName: { fontSize: 14, fontWeight: '900', color: colorsB.ink },
  templDesc: { fontSize: 10.5, fontWeight: '600', color: colorsB.inkSoft, marginTop: 3, lineHeight: 14 },

  // Step 4
  inputBox: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 14,
    padding: spacingB.lg,
    marginBottom: spacingB.md,
    ...shadowsB.card,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colorsB.inkSoft,
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    fontWeight: '700',
    color: colorsB.ink,
    padding: 0,
  },
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
  heroValue: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5, color: colorsB.ink },
  heroUnit: { fontSize: 14, color: colorsB.inkSoft, fontWeight: '700', marginLeft: 4 },
  heroSteppers: { flexDirection: 'row', gap: 14, marginTop: 10 },
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
  presetText: { fontSize: 11, fontWeight: '800', color: colorsB.ink },
  doubleRow: { flexDirection: 'row', gap: 8 },
  miniBox: {
    flex: 1,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    ...shadowsB.card,
  },
  miniLabel: {
    fontSize: 9.5,
    color: colorsB.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
    marginBottom: 4,
  },
  miniValue: { fontSize: 22, fontWeight: '900', color: colorsB.ink },

  // Step 5
  vTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 14,
    marginBottom: 7,
    ...shadowsB.card,
  },
  vTileActive: { backgroundColor: colorsB.green },
  vIcon: {
    width: 32,
    height: 32,
    backgroundColor: colorsB.bgWarm,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vName: { fontSize: 12.5, fontWeight: '900', color: colorsB.ink },
  vDesc: { fontSize: 10, fontWeight: '700', color: colorsB.inkSoft },
  strengthBar: { width: 4, height: 9, backgroundColor: 'rgba(28,20,16,0.2)', borderRadius: 1 },

  // Step 6
  rCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 16,
    marginBottom: 8,
    ...shadowsB.card,
  },
  rCardActive: { backgroundColor: colorsB.orange },
  rEmoji: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rName: { fontSize: 14, fontWeight: '900', color: colorsB.ink },
  rDesc: { fontSize: 10.5, fontWeight: '600', color: colorsB.inkSoft, marginTop: 2, lineHeight: 14 },
  badgePill: {
    backgroundColor: colorsB.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  badgePillText: { fontSize: 9, fontWeight: '800', color: colorsB.bgWarm, letterSpacing: 0.5 },

  // Step 7
  calCard: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 18,
    padding: 14,
    marginBottom: spacingB.md,
    ...shadowsB.card,
  },
  calRange: { fontSize: 17, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.4 },
  calSub: { fontSize: 10.5, color: colorsB.inkSoft, marginTop: 3, fontWeight: '600' },
  visRow: { flexDirection: 'row', gap: 5 },
  visPill: {
    flex: 1,
    paddingVertical: 9,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 100,
    alignItems: 'center',
    ...shadowsB.card,
  },
  visPillActive: { backgroundColor: colorsB.orange },
  visPillText: { fontSize: 11, fontWeight: '800', color: colorsB.ink },

  // Step 8
  heroSummary: {
    backgroundColor: colorsB.green,
    borderWidth: 2.5,
    borderColor: colorsB.ink,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    ...shadowsB.cardLg,
  },
  hsTag: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colorsB.paper, fontWeight: '800', marginBottom: 6 },
  hsTitle: { fontSize: 19, fontWeight: '900', color: colorsB.paper, letterSpacing: -0.4, lineHeight: 22, marginBottom: 8 },
  hsMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  hsPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 },
  hsPillText: { fontSize: 10, fontWeight: '700', color: colorsB.paper },
  breakdown: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    ...shadowsB.card,
  },
  brRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  brKey: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '600' },
  brVal: { fontSize: 11, fontWeight: '800', color: colorsB.ink },
  riskBanner: {
    backgroundColor: colorsB.greenSoft,
    borderWidth: 2,
    borderColor: colorsB.green,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  checkIcon: {
    width: 22,
    height: 22,
    backgroundColor: colorsB.green,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskText: { fontSize: 11, fontWeight: '600', color: '#1f3a1d', lineHeight: 15 },
});
