/**
 * North Star System
 * 
 * The complete gravitational layout system.
 * Orchestrates:
 * - NorthStarCore (center)
 * - ConstellationNodes (orbiting elements)
 * - RadialActionMenu (long-press)
 * - Single Insight
 * - Confidence display
 * 
 * Rules:
 * - Star is always mathematically centered
 * - No clipping on any device
 * - Nodes placed via polar math
 * - Minimum 44px hit targets
 */

import { Colors } from '@/constants/theme';
import {
    calculateDirection,
    Direction,
    getCenterPoint,
    getConstellationPositions,
    getSafeRadius,
    getStarDiameter,
} from '@/lib/north-star-layout';
import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '../themed-text';
import { ConstellationNode, ConstellationNodeData } from './ConstellationNode';
import { NorthStarCore } from './NorthStarCore';
import { RadialAction, RadialActionMenu } from './RadialActionMenu';

interface NorthStarSystemProps {
    // Financial data
    totals?: {
        inflow: number;
        outflow: number;
        netCashflow: number;
    };
    confidence?: {
        score: number;
        reasons: string[];
    };
    direction?: Direction;
    insight?: string;

    // Callbacks
    onUpdateDirection?: () => void;
    onStarPress?: () => void;

    // State
    hasData: boolean;
}

export function NorthStarSystem({
    totals,
    confidence,
    direction: providedDirection,
    insight,
    onUpdateDirection,
    onStarPress,
    hasData,
}: NorthStarSystemProps) {
    const [showRadialMenu, setShowRadialMenu] = useState(false);
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    // Calculate center and layout
    const center = getCenterPoint();
    const safeRadius = getSafeRadius();
    const starDiameter = getStarDiameter();

    // Calculate direction from data or use provided
    const direction = useMemo(() => {
        if (providedDirection) return providedDirection;
        if (!totals) return 'stable' as Direction;
        return calculateDirection(totals.netCashflow, totals.inflow);
    }, [providedDirection, totals]);

    const confidenceScore = confidence?.score ?? 0;
    const netCashflow = totals?.netCashflow ?? 0;

    // Constellation nodes (max 2 for Phase 1: confidence + action)
    const nodes = useMemo<ConstellationNodeData[]>(() => {
        if (!hasData) return [];

        const result: ConstellationNodeData[] = [];

        // Confidence node
        if (confidenceScore > 0) {
            result.push({
                id: 'confidence',
                label: 'Confidence',
                type: 'confidence',
                value: `${Math.round(confidenceScore)}%`,
                importance: confidenceScore / 100,
            });
        }

        return result;
    }, [hasData, confidenceScore]);

    // Node positions
    const nodePositions = useMemo(() => {
        if (nodes.length === 0) return [];
        return getConstellationPositions(nodes.length, confidenceScore / 100);
    }, [nodes.length, confidenceScore]);

    // Radial menu actions (V2 Blueprint: max 3, upload-focused)
    const radialActions: RadialAction[] = [
        {
            id: 'analyze',
            label: 'Analyze statement',
            icon: '📄',
            onPress: () => onUpdateDirection?.(),
        },
        {
            id: 'history',
            label: 'Past reports',
            icon: '📊',
            onPress: () => onStarPress?.(),
        },
    ];

    const handleLongPress = useCallback(() => {
        setShowRadialMenu(true);
    }, []);

    const handleDismissMenu = useCallback(() => {
        setShowRadialMenu(false);
    }, []);

    return (
        <View style={[styles.container, { width: screenWidth, height: screenHeight * 0.7 }]}>
            {/* Safe area boundary (invisible, for debug) */}
            {__DEV__ && (
                <View
                    style={[
                        styles.safeBoundary,
                        {
                            width: safeRadius * 2,
                            height: safeRadius * 2,
                            borderRadius: safeRadius,
                            left: center.x - safeRadius,
                            top: center.y - safeRadius - 100, // Offset for component position
                        },
                    ]}
                />
            )}

            {/* Constellation Nodes */}
            {nodes.map((node, index) => (
                <ConstellationNode
                    key={node.id}
                    data={node}
                    position={{
                        x: nodePositions[index]?.x ?? center.x,
                        y: (nodePositions[index]?.y ?? center.y) - 100,
                    }}
                    delay={500 + index * 100}
                />
            ))}

            {/* North Star Core - Always centered in available space */}
            <View style={styles.starContainer}>
                <NorthStarCore
                    direction={direction}
                    confidence={confidenceScore / 100}
                    netCashflow={netCashflow}
                    onPress={onStarPress}
                    onLongPress={handleLongPress}
                />
            </View>

            {/* Single Insight - Below the star */}
            {insight && (
                <Animated.View
                    entering={FadeInDown.delay(600).duration(400)}
                    style={styles.insightContainer}
                >
                    <View style={styles.insightCard}>
                        <ThemedText style={styles.insightLabel}>INSIGHT</ThemedText>
                        <ThemedText style={styles.insightText}>{insight}</ThemedText>
                    </View>
                </Animated.View>
            )}

            {/* Confidence reason - Subtle display */}
            {confidence?.reasons?.[0] && (
                <Animated.View
                    entering={FadeIn.delay(800).duration(400)}
                    style={styles.confidenceReasonContainer}
                >
                    <ThemedText style={styles.confidenceReason}>
                        {confidence.reasons[0]}
                    </ThemedText>
                </Animated.View>
            )}

            {/* Empty state */}
            {!hasData && (
                <Animated.View
                    entering={FadeIn.delay(300).duration(400)}
                    style={styles.emptyState}
                >
                    <ThemedText style={styles.emptyText}>
                        Tap the star to begin
                    </ThemedText>
                </Animated.View>
            )}

            {/* Radial Action Menu */}
            <RadialActionMenu
                visible={showRadialMenu}
                actions={radialActions}
                centerX={center.x}
                centerY={center.y}
                onDismiss={handleDismissMenu}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    safeBoundary: {
        position: 'absolute',
        borderWidth: 1,
        borderColor: 'rgba(255,0,0,0.2)',
        borderStyle: 'dashed',
    },
    starContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 60, // Make room for insight
    },
    insightContainer: {
        position: 'absolute',
        bottom: 80,
        left: 24,
        right: 24,
    },
    insightCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    insightLabel: {
        fontSize: 10,
        color: Colors.aurora.cyan,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 6,
    },
    insightText: {
        fontSize: 15,
        color: Colors.aurora.text,
        lineHeight: 22,
    },
    confidenceReasonContainer: {
        position: 'absolute',
        bottom: 40,
        left: 24,
        right: 24,
        alignItems: 'center',
    },
    confidenceReason: {
        fontSize: 12,
        color: Colors.aurora.muted,
        textAlign: 'center',
    },
    emptyState: {
        position: 'absolute',
        bottom: 100,
        left: 24,
        right: 24,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: Colors.aurora.muted,
    },
});
