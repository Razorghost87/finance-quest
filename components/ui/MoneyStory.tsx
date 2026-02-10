/**
 * Money Story - "Your money story this month" narrative display
 */
import { Colors } from '@/constants/theme';
import { Insight } from '@/lib/insight-engine';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

interface MoneyStoryProps {
    story: string;
    insights: Insight[];
}

export function MoneyStory({ story, insights }: MoneyStoryProps) {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(52,245,197,0.1)', 'rgba(79,209,255,0.05)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            />
            <ThemedText style={styles.storyText}>{story}</ThemedText>

            {insights.length > 0 && (
                <View style={styles.insightsList}>
                    {insights.slice(0, 3).map((insight) => (
                        <View key={insight.id} style={styles.insightRow}>
                            <ThemedText style={styles.insightIcon}>{insight.icon}</ThemedText>
                            <ThemedText style={[
                                styles.insightText,
                                insight.type === 'positive' && styles.positiveText,
                                insight.type === 'warning' && styles.warningText,
                            ]}>
                                {insight.text}
                            </ThemedText>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    storyText: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.aurora.text,
        lineHeight: 24,
        marginBottom: 16,
    },
    insightsList: {
        gap: 12,
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    insightIcon: {
        fontSize: 16,
        marginTop: 2,
    },
    insightText: {
        flex: 1,
        fontSize: 14,
        color: Colors.aurora.muted,
        lineHeight: 20,
    },
    positiveText: {
        color: Colors.aurora.green,
    },
    warningText: {
        color: Colors.aurora.yellow,
    },
});
