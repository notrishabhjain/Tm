import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/ui/theme/colors';
import { Button } from '@/ui/components/Button';

export default function AiModelScreen(): React.JSX.Element {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Signal Engine</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.heading}>No AI models required</Text>
        <Text style={styles.description}>
          TaskMind uses a deterministic signal scoring engine derived from real notification data.
          It runs fully on-device with zero RAM overhead and no downloads needed.
        </Text>
        <Text style={styles.stats}>17 positive signals · 7 negative signals</Text>
        <Text style={styles.stats}>Empirically tuned from 4,064 real messages</Text>
        <Text style={styles.stats}>Self-learning via sender stats and n-gram feedback</Text>
      </View>
      <View style={styles.footer}>
        <Button label="Back" variant="secondary" onPress={() => router.back()} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundLight },
  header: {
    padding: 20,
    paddingTop: 56,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.primary900 },
  body: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: Colors.primary900, marginBottom: 8 },
  description: {
    fontSize: 15,
    color: Colors.onSurfaceVariantLight,
    lineHeight: 22,
    marginBottom: 8,
  },
  stats: { fontSize: 14, color: Colors.primary500, fontWeight: '500' },
  footer: { padding: 16 },
});
