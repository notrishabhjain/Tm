import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/ui/theme/colors';
import { EmptyState } from '@/ui/components/EmptyState';
import { LearnedKeywordRepository } from '@/data/repositories/LearnedKeywordRepository';
import { db } from '@/data/db/client';
import type { LearnedKeyword } from '@/data/repositories/LearnedKeywordRepository';

const repo = new LearnedKeywordRepository(db);

type VocabTab = 'ACTIVE' | 'PENDING' | 'DEMOTED';

export default function VocabularyScreen(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<VocabTab>('ACTIVE');

  const { data: all = [] } = useQuery({
    queryKey: ['learned-keywords'],
    queryFn: () => repo.getAll(),
    refetchInterval: 10000,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: LearnedKeyword['status'] }) =>
      repo.setStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['learned-keywords'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => repo.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['learned-keywords'] }),
  });

  const filtered = all.filter((k) => k.status === tab);

  const tabCounts: Record<VocabTab, number> = {
    ACTIVE: all.filter((k) => k.status === 'ACTIVE').length,
    PENDING: all.filter((k) => k.status === 'PENDING').length,
    DEMOTED: all.filter((k) => k.status === 'DEMOTED').length,
  };

  const handleRemove = (kw: LearnedKeyword): void => {
    Alert.alert('Remove keyword?', `"${kw.ngram}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(kw.id) },
    ]);
  };

  const emptyMessages: Record<VocabTab, { title: string; description: string }> = {
    ACTIVE: {
      title: 'No active keywords yet',
      description:
        'TaskMind learns from the tasks you confirm. Frequent phrases (3+ times) are promoted here and used to improve detection.',
    },
    PENDING: {
      title: 'Nothing pending',
      description: 'Phrases seen fewer than 3 times appear here while they accumulate evidence.',
    },
    DEMOTED: {
      title: 'Nothing demoted',
      description: 'Keywords you manually remove from Active appear here.',
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Settings</Text>
        </Pressable>
        <Text style={styles.title}>Learned Vocabulary</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.tabBar}>
        {(['ACTIVE', 'PENDING', 'DEMOTED'] as VocabTab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0) + t.slice(1).toLowerCase()} ({tabCounts[t]})
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            title={emptyMessages[tab].title}
            description={emptyMessages[tab].description}
          />
        }
        renderItem={({ item }) => (
          <KeywordRow
            keyword={item}
            tab={tab}
            onPromote={() => setStatusMutation.mutate({ id: item.id, status: 'ACTIVE' })}
            onDemote={() => setStatusMutation.mutate({ id: item.id, status: 'DEMOTED' })}
            onRemove={() => handleRemove(item)}
          />
        )}
      />
    </View>
  );
}

function KeywordRow({
  keyword,
  tab,
  onPromote,
  onDemote,
  onRemove,
}: {
  keyword: LearnedKeyword;
  tab: VocabTab;
  onPromote: () => void;
  onDemote: () => void;
  onRemove: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.phrase}>{keyword.ngram}</Text>
        <Text style={styles.meta}>
          {keyword.language} · seen {keyword.occurrenceCount}×
        </Text>
      </View>
      <View style={styles.actions}>
        {tab === 'PENDING' && (
          <Pressable style={styles.actionBtn} onPress={onPromote}>
            <Text style={[styles.actionBtnText, { color: Colors.success }]}>Activate</Text>
          </Pressable>
        )}
        {tab === 'ACTIVE' && (
          <Pressable style={styles.actionBtn} onPress={onDemote}>
            <Text style={[styles.actionBtnText, { color: Colors.onSurfaceVariantLight }]}>
              Demote
            </Text>
          </Pressable>
        )}
        {tab === 'DEMOTED' && (
          <Pressable style={styles.actionBtn} onPress={onPromote}>
            <Text style={[styles.actionBtnText, { color: Colors.success }]}>Restore</Text>
          </Pressable>
        )}
        <Pressable style={styles.actionBtn} onPress={onRemove}>
          <Text style={[styles.actionBtnText, { color: Colors.error }]}>Remove</Text>
        </Pressable>
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
    padding: 16,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  backButton: { padding: 4 },
  backText: { fontSize: 16, color: Colors.primary500, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.onSurfaceLight },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.transparent,
  },
  tabActive: { borderBottomColor: Colors.primary500 },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.onSurfaceVariantLight },
  tabTextActive: { color: Colors.primary500, fontWeight: '600' },
  list: { paddingVertical: 8 },
  emptyContainer: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 14,
    elevation: 1,
  },
  rowMain: { flex: 1 },
  phrase: { fontSize: 14, fontWeight: '600', color: Colors.onSurfaceLight, marginBottom: 2 },
  meta: { fontSize: 12, color: Colors.onSurfaceVariantLight },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { padding: 4 },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
});
