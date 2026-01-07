import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface TrustPanelProps {
  confidence?: {
    score?: number;
    grade?: 'high' | 'medium' | 'low';
    reasons?: string[];
  };
}

export function TrustPanel({ confidence }: TrustPanelProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const score = confidence?.score ?? 0;
  const grade = confidence?.grade || 'medium';
  const reasons = confidence?.reasons || [];

  const getGradeColor = () => {
    if (grade === 'high') return '#4ade80';
    if (grade === 'medium') return '#fbbf24';
    return '#f87171';
  };

  return (
    <>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Trust & Confidence</ThemedText>
          <Pressable onPress={() => setModalVisible(true)}>
            <ThemedText style={styles.link}>How we calculated this</ThemedText>
          </Pressable>
        </View>
        <View style={styles.scoreContainer}>
          <View style={[styles.scoreCircle, { borderColor: getGradeColor() }]}>
            <ThemedText style={[styles.score, { color: getGradeColor() }]}>
              {Math.round(score * 100)}%
            </ThemedText>
          </View>
          <ThemedText style={[styles.grade, { color: getGradeColor() }]}>
            {grade === 'high' ? 'High' : grade === 'medium' ? 'Medium' : 'Low'} Confidence
          </ThemedText>
        </View>
        {reasons.length > 0 && (
          <View style={styles.reasons}>
            {reasons.slice(0, 3).map((reason, index) => (
              <View key={index} style={styles.reasonItem}>
                <ThemedText style={styles.reasonBullet}>•</ThemedText>
                <ThemedText style={styles.reasonText}>{reason}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </ThemedView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>How We Calculate Confidence</ThemedText>
            <ThemedText style={styles.modalText}>
              Our confidence score is based on three factors:
            </ThemedText>
            <View style={styles.modalList}>
              <ThemedText style={styles.modalListItem}>
                • <ThemedText style={styles.modalListBold}>Reconciliation (45%)</ThemedText>: How well the statement balances match
              </ThemedText>
              <ThemedText style={styles.modalListItem}>
                • <ThemedText style={styles.modalListBold}>Extraction Completeness (35%)</ThemedText>: How many transactions we successfully extracted
              </ThemedText>
              <ThemedText style={styles.modalListItem}>
                • <ThemedText style={styles.modalListBold}>Subscription Detection (20%)</ThemedText>: How confident we are in recurring charge detection
              </ThemedText>
            </View>
            <Pressable style={styles.modalClose} onPress={() => setModalVisible(false)}>
              <ThemedText style={styles.modalCloseText}>Close</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  link: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  score: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  grade: {
    fontSize: 16,
    fontWeight: '600',
  },
  reasons: {
    gap: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reasonBullet: {
    fontSize: 16,
    color: '#888',
    marginRight: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 16,
    lineHeight: 24,
  },
  modalList: {
    gap: 12,
    marginBottom: 20,
  },
  modalListItem: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
  },
  modalListBold: {
    fontWeight: '600',
    color: '#fff',
  },
  modalClose: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

