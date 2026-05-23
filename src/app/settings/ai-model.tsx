import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/ui/theme/colors';

const DEPTH = 4;

const SIGNALS = [
  { label: 'Imperative verb (EN)', weight: '+0.20' },
  { label: 'Imperative verb (HI)', weight: '+0.20' },
  { label: 'Deadline expression', weight: '+0.18' },
  { label: 'Action keyword match', weight: '+0.15' },
  { label: 'VIP sender', weight: '+0.20' },
  { label: 'Question to recipient', weight: '+0.12' },
  { label: 'Calendar time reference', weight: '+0.10' },
  { label: 'Confirmation request', weight: '+0.08' },
  { label: 'Short directive (<8 words)', weight: '+0.07' },
  { label: 'Learned n-gram match', weight: '+0.05-0.15' },
];

const NEGATIVE_SIGNALS = [
  { label: 'Promotional pattern', weight: '−0.20' },
  { label: 'OTP / verification code', weight: '−1.00 (discard)' },
  { label: 'Aggregate badge', weight: '−1.00 (discard)' },
  { label: 'Call notification', weight: '−1.00 (discard)' },
  { label: 'Sync / progress', weight: '−1.00 (discard)' },
  { label: 'System package', weight: '−1.00 (discard)' },
  { label: 'Carrier sender ID', weight: '−1.00 (discard)' },
];

export default function AiModelScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Signal Engine</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero card */}
        <View style={[styles.heroWrapper, { paddingRight: DEPTH, paddingBottom: DEPTH }]}>
          <View style={styles.heroShadow} />
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>No AI models required</Text>
            <Text style={styles.heroDesc}>
              TaskMind uses a deterministic signal scoring engine derived from real notification
              data. It runs fully on-device with zero RAM overhead and no downloads needed.
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillNum}>17</Text>
                <Text style={styles.statPillLabel}>positive signals</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillNum}>7</Text>
                <Text style={styles.statPillLabel}>negative signals</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillNum}>4,064</Text>
                <Text style={styles.statPillLabel}>training messages</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Positive signals */}
        <Text style={styles.sectionLabel}>POSITIVE SIGNALS (sample)</Text>
        <View style={[styles.tableWrapper, { paddingRight: DEPTH, paddingBottom: DEPTH }]}>
          <View style={styles.tableShadow} />
          <View style={styles.table}>
            {SIGNALS.map((s, i) => (
              <View key={s.label} style={[styles.tableRow, i > 0 && styles.tableRowBorder]}>
                <Text style={styles.tableLabel}>{s.label}</Text>
                <Text style={[styles.tableWeight, { color: Colors.success }]}>{s.weight}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Negative signals */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>NEGATIVE SIGNALS</Text>
        <View style={[styles.tableWrapper, { paddingRight: DEPTH, paddingBottom: DEPTH }]}>
          <View style={[styles.tableShadow, { backgroundColor: Colors.neoShadowUrgent }]} />
          <View style={[styles.table, { borderColor: Colors.urgentFg }]}>
            {NEGATIVE_SIGNALS.map((s, i) => (
              <View key={s.label} style={[styles.tableRow, i > 0 && styles.tableRowBorder]}>
                <Text style={styles.tableLabel}>{s.label}</Text>
                <Text style={[styles.tableWeight, { color: Colors.urgentFg }]}>{s.weight}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footnote}>
          Self-learning via sender stats and n-gram feedback — each confirmation/rejection updates
          weights.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.primary900,
    borderBottomWidth: 2,
    borderBottomColor: Colors.black,
  },
  backBtn: { padding: 4, minWidth: 56 },
  backText: { fontSize: 15, color: Colors.white, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '800', color: Colors.white },
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  heroWrapper: { position: 'relative' },
  heroShadow: {
    position: 'absolute',
    top: DEPTH,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.neoShadowDefault,
    borderRadius: 2,
  },
  heroCard: {
    backgroundColor: Colors.primary900,
    borderWidth: 2,
    borderColor: Colors.black,
    borderRadius: 2,
    padding: 20,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  heroDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', gap: 8 },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    padding: 10,
    alignItems: 'center',
  },
  statPillNum: { fontSize: 18, fontWeight: '800', color: Colors.white },
  statPillLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary900,
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  tableWrapper: { position: 'relative' },
  tableShadow: {
    position: 'absolute',
    top: DEPTH,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.neoShadowDefault,
    borderRadius: 2,
  },
  table: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.primary900,
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: Colors.outlineLight },
  tableLabel: { fontSize: 13, color: Colors.onSurfaceLight, flex: 1, fontWeight: '500' },
  tableWeight: { fontSize: 12, fontWeight: '700', marginLeft: 8 },
  footnote: {
    fontSize: 12,
    color: Colors.onSurfaceVariantLight,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
