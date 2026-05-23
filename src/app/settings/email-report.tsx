import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/ui/theme/colors';

export default function EmailReportScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Daily Email Report</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>STATUS</Text>
            <Text style={styles.statusValue}>Not configured</Text>
          </View>
          <Text style={styles.description}>
            Daily email digests summarise your completed and pending tasks. This feature requires
            SMTP server credentials and is not yet available.
          </Text>
        </View>
      </View>
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
  content: { flex: 1, padding: 16 },
  card: {
    marginTop: 8,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.outlineLight,
    borderRadius: 2,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.onSurfaceVariantLight,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurfaceVariantLight,
  },
  description: {
    fontSize: 13,
    color: Colors.onSurfaceVariantLight,
    lineHeight: 20,
  },
});
