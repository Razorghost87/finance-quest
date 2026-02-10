/**
 * Radial Constellation Component
 * 
 * The visual node system for North.
 * 
 * Features:
 * - Centered North Star (never clipped)
 * - 4 fixed force nodes at dynamic radial positions
 * - Screen-size adaptive positioning
 * - Tap interactions that highlight constellation
 * - Node insight panel (Impact, Magnitude, Recovery)
 * 
 * Visual rules:
 * - Aurora color system on dark background
 * - Line thickness = magnitude
 * - Pulse speed = confidence
 */

import { Colors } from '@/constants/theme';
import { northHaptics } from '@/lib/haptics';
import {
    ForceNodeData,
    ForceNodeType,
    getAllNodePositions,
    getImpactVisuals,
    getLineThickness,
    getNodeRadius,
    getOrbitRadius,
    getStarRadius,
    MIN_TOUCH_TARGET,
} from '@/lib/radial-layout';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { ThemedText } from '../themed-text';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RadialConstellationProps {
    nodes: ForceNodeData[];
    direction: 'on-course' | 'drifting' | 'off-course';
    confidence: number; // 0-100
    containerHeight?: number;
}

export function RadialConstellation({
    nodes,
    direction,
    confidence,
    containerHeight = 400,
}: RadialConstellationProps) {
    const [selectedNode, setSelectedNode] = useState<ForceNodeData | null>(null);
    const [activeNodeType, setActiveNodeType] = useState<ForceNodeType | null>(null);

    // Calculate center and radius
    const centerX = SCREEN_WIDTH / 2;
    const centerY = containerHeight / 2;
    const orbitRadius = getOrbitRadius();
    const starRadius = getStarRadius();

    // Get all node positions
    const nodePositions = useMemo(
        () => getAllNodePositions(centerX, centerY, orbitRadius),
        [centerX, centerY, orbitRadius]
    );

    // Handle node tap
    const handleNodePress = useCallback((node: ForceNodeData) => {
        northHaptics.medium();
        setSelectedNode(node);
        setActiveNodeType(node.type);
    }, []);

    // Close insight panel
    const handleCloseInsight = useCallback(() => {
        setSelectedNode(null);
        setActiveNodeType(null);
        northHaptics.light();
    }, []);

    // Handle star tap - reset selection
    const handleStarPress = useCallback(() => {
        northHaptics.light();
        setActiveNodeType(null);
    }, []);

    return (
        <View style={[styles.container, { height: containerHeight }]}>
            {/* Connection Lines (SVG) */}
            <Svg
                style={StyleSheet.absoluteFill}
                width={SCREEN_WIDTH}
                height={containerHeight}
            >
                {nodes.map((node) => {
                    const pos = nodePositions[node.type];
                    const isActive = activeNodeType === node.type;
                    const visuals = getImpactVisuals(node.impact);
                    const thickness = getLineThickness(node.magnitude);

                    return (
                        <Line
                            key={`line-${node.type}`}
                            x1={centerX}
                            y1={centerY}
                            x2={pos.x}
                            y2={pos.y}
                            stroke={isActive ? visuals.color : 'rgba(255,255,255,0.15)'}
                            strokeWidth={isActive ? thickness + 1 : thickness}
                            strokeLinecap="round"
                        />
                    );
                })}
            </Svg>

            {/* Central North Star */}
            <CentralStar
                x={centerX}
                y={centerY}
                radius={starRadius}
                direction={direction}
                confidence={confidence}
                onPress={handleStarPress}
                isActive={activeNodeType === null}
            />

            {/* Force Nodes */}
            {nodes.map((node, index) => {
                const pos = nodePositions[node.type];
                const isActive = activeNodeType === node.type;
                const isDimmed = activeNodeType !== null && !isActive;

                return (
                    <ForceNode
                        key={node.type}
                        node={node}
                        x={pos.x}
                        y={pos.y}
                        index={index}
                        isActive={isActive}
                        isDimmed={isDimmed}
                        onPress={() => handleNodePress(node)}
                    />
                );
            })}

            {/* Node Insight Panel */}
            {selectedNode && (
                <NodeInsightPanel
                    node={selectedNode}
                    onClose={handleCloseInsight}
                />
            )}
        </View>
    );
}

/**
 * Central Star Component
 */
interface CentralStarProps {
    x: number;
    y: number;
    radius: number;
    direction: 'on-course' | 'drifting' | 'off-course';
    confidence: number;
    onPress: () => void;
    isActive: boolean;
}

function CentralStar({
    x,
    y,
    radius,
    direction,
    confidence,
    onPress,
    isActive,
}: CentralStarProps) {
    const scale = useSharedValue(1);
    const glowOpacity = useSharedValue(0.5);

    // Pulse animation - speed based on confidence
    useEffect(() => {
        const pulseDuration = 3000 - confidence * 15; // 1500-3000ms

        scale.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: pulseDuration / 2, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: pulseDuration / 2, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        glowOpacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: pulseDuration / 2 }),
                withTiming(0.4, { duration: pulseDuration / 2 })
            ),
            -1,
            true
        );
    }, [confidence, scale, glowOpacity]);

    const starStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    // Colors based on direction
    const getColors = () => {
        switch (direction) {
            case 'on-course':
                return { primary: '#00FFA3', secondary: '#00D2FF', glow: 'rgba(0,255,163,0.4)' };
            case 'drifting':
                return { primary: '#FFC107', secondary: '#FF9800', glow: 'rgba(255,193,7,0.4)' };
            case 'off-course':
                return { primary: '#FF4D4D', secondary: '#FF1744', glow: 'rgba(255,77,77,0.4)' };
        }
    };

    const colors = getColors();

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.starContainer,
                {
                    left: x - radius,
                    top: y - radius,
                    width: radius * 2,
                    height: radius * 2,
                },
            ]}
        >
            {/* Glow */}
            <Animated.View
                style={[
                    styles.starGlow,
                    glowStyle,
                    {
                        width: radius * 2.5,
                        height: radius * 2.5,
                        borderRadius: radius * 1.25,
                        backgroundColor: colors.glow,
                    },
                ]}
            />

            {/* Star */}
            <Animated.View
                style={[
                    styles.star,
                    starStyle,
                    {
                        width: radius * 2,
                        height: radius * 2,
                        borderRadius: radius,
                        opacity: isActive ? 1 : 0.85,
                    },
                ]}
            >
                <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    style={styles.starGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <ThemedText style={styles.starIcon}>✦</ThemedText>
                </LinearGradient>
            </Animated.View>
        </Pressable>
    );
}

/**
 * Force Node Component
 */
interface ForceNodeProps {
    node: ForceNodeData;
    x: number;
    y: number;
    index: number;
    isActive: boolean;
    isDimmed: boolean;
    onPress: () => void;
}

function ForceNode({
    node,
    x,
    y,
    index,
    isActive,
    isDimmed,
    onPress,
}: ForceNodeProps) {
    const scale = useSharedValue(0);
    const visuals = getImpactVisuals(node.impact);
    const nodeRadius = getNodeRadius();

    // Entry animation
    useEffect(() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    }, [scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: isActive ? 1.15 : scale.value }],
        opacity: isDimmed ? 0.4 : 1,
    }));

    // Get icon for node type
    const getIcon = () => {
        switch (node.type) {
            case 'income': return '📈';
            case 'fixed': return '🏠';
            case 'flexible': return '🛒';
            case 'savings': return node.impact === 'positive' ? '💰' : '📉';
        }
    };

    return (
        <Animated.View
            entering={FadeIn.delay(index * 100).duration(300)}
            style={[
                styles.nodeContainer,
                animatedStyle,
                {
                    left: x - Math.max(nodeRadius, MIN_TOUCH_TARGET / 2),
                    top: y - Math.max(nodeRadius, MIN_TOUCH_TARGET / 2),
                    width: Math.max(nodeRadius * 2, MIN_TOUCH_TARGET),
                    height: Math.max(nodeRadius * 2, MIN_TOUCH_TARGET),
                },
            ]}
        >
            <Pressable
                onPress={onPress}
                style={[
                    styles.nodeButton,
                    {
                        borderColor: isActive ? visuals.color : 'rgba(255,255,255,0.2)',
                        backgroundColor: isActive
                            ? visuals.glowColor
                            : 'rgba(20,20,20,0.9)',
                    },
                ]}
            >
                <ThemedText style={styles.nodeIcon}>{getIcon()}</ThemedText>
                <ThemedText
                    style={[styles.nodeLabel, isActive && { color: visuals.color }]}
                >
                    {node.label}
                </ThemedText>
            </Pressable>
        </Animated.View>
    );
}

/**
 * Node Insight Panel
 * Shows exactly 3 things: Impact, Magnitude, Recovery
 */
interface NodeInsightPanelProps {
    node: ForceNodeData;
    onClose: () => void;
}

function NodeInsightPanel({ node, onClose }: NodeInsightPanelProps) {
    const visuals = getImpactVisuals(node.impact);

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.insightOverlay} onPress={onClose}>
                <Animated.View
                    entering={FadeInDown.duration(300)}
                    style={styles.insightPanel}
                >
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <View style={styles.insightHeader}>
                            <View style={[styles.insightDot, { backgroundColor: visuals.color }]} />
                            <ThemedText style={styles.insightTitle}>{node.label}</ThemedText>
                        </View>

                        {/* Impact Statement */}
                        <View style={styles.insightRow}>
                            <ThemedText style={styles.insightLabel}>IMPACT</ThemedText>
                            <ThemedText style={styles.insightValue}>
                                {node.insight.statement}
                            </ThemedText>
                        </View>

                        {/* Magnitude */}
                        <View style={styles.insightRow}>
                            <ThemedText style={styles.insightLabel}>MAGNITUDE</ThemedText>
                            <ThemedText style={[styles.insightMagnitude, { color: visuals.color }]}>
                                {node.insight.magnitude}
                            </ThemedText>
                        </View>

                        {/* Recovery Hint */}
                        <View style={[styles.insightRow, styles.insightRowLast]}>
                            <ThemedText style={styles.insightLabel}>RECOVERY</ThemedText>
                            <ThemedText style={styles.insightRecovery}>
                                {node.insight.recovery}
                            </ThemedText>
                        </View>

                        {/* Close Button */}
                        <Pressable style={styles.insightClose} onPress={onClose}>
                            <ThemedText style={styles.insightCloseText}>Got it</ThemedText>
                        </Pressable>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        position: 'relative',
    },
    // Star styles
    starContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    starGlow: {
        position: 'absolute',
    },
    star: {
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    starGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    starIcon: {
        fontSize: 32,
        color: '#000',
    },
    // Node styles
    nodeContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    nodeButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 24,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        minWidth: 80,
    },
    nodeIcon: {
        fontSize: 16,
    },
    nodeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.aurora.text,
    },
    // Insight panel styles
    insightOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
        padding: 24,
        paddingBottom: 48,
    },
    insightPanel: {
        backgroundColor: Colors.aurora.card,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    insightDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    insightTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.aurora.text,
    },
    insightRow: {
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    insightRowLast: {
        borderBottomWidth: 0,
        marginBottom: 8,
    },
    insightLabel: {
        fontSize: 10,
        color: Colors.aurora.muted,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 6,
    },
    insightValue: {
        fontSize: 15,
        color: Colors.aurora.text,
        lineHeight: 22,
    },
    insightMagnitude: {
        fontSize: 24,
        fontWeight: '800',
    },
    insightRecovery: {
        fontSize: 14,
        color: Colors.aurora.green,
        fontStyle: 'italic',
        lineHeight: 20,
    },
    insightClose: {
        marginTop: 8,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: Colors.aurora.green,
        alignItems: 'center',
    },
    insightCloseText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
});
