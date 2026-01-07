import { StyleSheet, ScrollView, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface SummaryDisplayProps {
  summary: string;
}

export function SummaryDisplay({ summary }: SummaryDisplayProps) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Document Summary
      </ThemedText>
      <ScrollView style={styles.scrollView}>
        <ThemedText style={styles.summaryText}>{summary}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.9,
  },
});

