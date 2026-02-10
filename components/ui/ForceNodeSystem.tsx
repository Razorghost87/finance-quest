/**
 * Force Node System
 * 
 * Phase 1 fixed nodes representing forces affecting direction.
 * Nodes are not decorative - they represent:
 * - Income (positive force)
 * - Fixed Obligations (committed)
 * - Flexible Spending (controllable)
 * - Savings/Drift (result)
 * 
 * Tapping shows impact on direction, not totals.
 */

import { Colors } from '@/constants/theme';
import { ForceNode } from '@/lib/direction-engine';
import { northHaptics } from '@/lib/haptics';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { ThemedText } from '../themed-text';

interface ForceNodeSystemProps {
    nodes: ForceNode[];
    onNodePress?: (node: ForceNode) => void;
}

export function ForceNodeSystem({ nodes, onNodePress }: ForceNodeSystemProps) {
    const [selectedNode, setSelectedNode] = useState<ForceNode | null>(null);

    const handleNodePress = useCallback((node: ForceNode) => {
        northHaptics.medium();
        setSelectedNode(node);
        onNodePress?.(node);
    }, [onNodePress]);

    return (
        <View style={styles.container}>
            <ThemedText style={styles.sectionLabel}>FORCES AFFECTING DIRECTION</ThemedText>

            <View style={styles.nodesGrid}>
                {nodes.map((node, index) => (
                    <ForceNodeCard
                        key={node.id}
                        node={node}
                        index={index}
                        onPress={() => handleNodePress(node)}
                    />
                ))}
            </View>

            {/* Detail Modal */}
            {selectedNode && (
                <ForceNodeDetail
                    node={selectedNode}
                    onClose={() => setSelectedNode(null)}
                />
            )}
        </View>
    );
}

interface ForceNodeCardProps {
    node: ForceNode;
    index: number;
    onPress: () => void;
}

function ForceNodeCard({ node, index, onPress }: ForceNodeCardProps) {
    const scale = useSharedValue(1);

    const handlePressIn = useCallback(() => {
        scale.value = withSpring(0.95);
        northHaptics.light();
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // Node visuals based on type and impact
    const getNodeColor = () => {
        if (node.impact === 'positive') return Colors.aurora.green;
        if (node.impact === 'negative') return Colors.aurora.red;
        return Colors.aurora.muted;
    };

    const getNodeIcon = () => {
        switch (node.type) {
            case 'income': return '📈';
            case 'fixed': return '🏠';
            case 'flexible': return '🛒';
            case 'drift': return node.impact === 'positive' ? '💰' : '📉';
            default: return '•';
        }
    };

    const color = getNodeColor();

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 100).duration(300)}
            style={[styles.nodeCard, animatedStyle]}
        >
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.nodeContent}
            >
                <View style={[styles.nodeIcon, { borderColor: color + '40' }]}>
                    <ThemedText style={styles.nodeEmoji}>{getNodeIcon()}</ThemedText>
                </View>
                <ThemedText style={styles.nodeName}>{node.name}</ThemedText>
                <ThemedText style={[styles.nodeAmount, { color }]}>
                    ${node.amount.toLocaleString()}
                </ThemedText>
                <View style={[styles.impactDot, { backgroundColor: color }]} />
            </Pressable>
        </Animated.View>
    );
}

interface ForceNodeDetailProps {
    node: ForceNode;
    onClose: () => void;
}

function ForceNodeDetail({ node, onClose }: ForceNodeDetailProps) {
    const getImpactExplanation = () => {
        switch (node.type) {
            case 'income':
                return node.impact === 'positive'
                    ? 'This income is propelling you forward.'
                    : 'No income detected — upload a statement with deposits.';
            case 'fixed':
                return 'Committed obligations. Hard to reduce quickly.';
            case 'flexible':
                return node.impact === 'negative'
                    ? 'This spending is pulling you off course. Reducing here has the fastest impact.'
                    : 'Discretionary spending within healthy range.';
            case 'drift':
                return node.impact === 'positive'
                    ? 'Positive savings — you\'re building margin.'
                    : 'Deficit is eroding your position. Address flexible spending first.';
            default:
                return node.description;
        }
    };

    const getActionableAdvice = () => {
        if (node.impact !== 'negative') return null;

        switch (node.type) {
            case 'flexible':
                return 'Reducing by 10-15% typically restores course.';
            case 'drift':
                return 'Focus on flexible spending — fixed obligations are harder to change quickly.';
            default:
                return null;
        }
    };

    const color = node.impact === 'positive'
        ? Colors.aurora.green
        : node.impact === 'negative'
            ? Colors.aurora.red
            : Colors.aurora.muted;

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Animated.View
                    entering={FadeIn.duration(200)}
                    style={styles.modalContent}
                >
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        <View style={styles.detailHeader}>
                            <ThemedText style={styles.detailName}>{node.name}</ThemedText>
                            <ThemedText style={[styles.detailAmount, { color }]}>
                                ${node.amount.toLocaleString()}
                            </ThemedText>
                        </View>

                        <View style={[styles.impactBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                            <ThemedText style={[styles.impactLabel, { color }]}>
                                {node.impact === 'positive' ? '↑ Positive Force'
                                    : node.impact === 'negative' ? '↓ Negative Force'
                                        : '→ Neutral'}
                            </ThemedText>
                        </View>

                        <ThemedText style={styles.detailDescription}>
                            {node.description}
                        </ThemedText>

                        <View style={styles.divider} />

                        <ThemedText style={styles.detailExplanation}>
                            {getImpactExplanation()}
                        </ThemedText>

                        {getActionableAdvice() && (
                            <View style={styles.adviceBox}>
                                <ThemedText style={styles.adviceText}>
                                    💡 {getActionableAdvice()}
                                </ThemedText>
                            </View>
                        )}

                        <Pressable style={styles.closeButton} onPress={onClose}>
                            <ThemedText style={styles.closeButtonText}>Got it</ThemedText>
                        </Pressable>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 24,
    },
    sectionLabel: {
        fontSize: 10,
        color: Colors.aurora.muted,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 16,
        textAlign: 'center',
    },
    nodesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    nodeCard: {
        width: '47%',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    nodeContent: {
        padding: 16,
        alignItems: 'center',
    },
    nodeIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    nodeEmoji: {
        fontSize: 20,
    },
    nodeName: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.aurora.text,
        marginBottom: 4,
        textAlign: 'center',
    },
    nodeAmount: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    impactDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: Colors.aurora.card,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    detailHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    detailName: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.aurora.text,
        marginBottom: 4,
    },
    detailAmount: {
        fontSize: 28,
        fontWeight: '800',
    },
    impactBadge: {
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
    },
    impactLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    detailDescription: {
        fontSize: 14,
        color: Colors.aurora.muted,
        textAlign: 'center',
        marginBottom: 16,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginVertical: 16,
    },
    detailExplanation: {
        fontSize: 15,
        color: Colors.aurora.text,
        lineHeight: 22,
        textAlign: 'center',
    },
    adviceBox: {
        backgroundColor: 'rgba(0,255,163,0.1)',
        borderRadius: 12,
        padding: 12,
        marginTop: 16,
    },
    adviceText: {
        fontSize: 13,
        color: Colors.aurora.green,
        textAlign: 'center',
    },
    closeButton: {
        marginTop: 20,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: Colors.aurora.green,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
});
