import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { NorthStarIcon } from './NorthStarIcon';

const { width } = Dimensions.get('window');

export interface Goal {
    id: string;
    label: string;
    progress: number; // 0 to 1
    color?: string;
    target: string; // e.g., "$10,000"
    current: string; // e.g., "$3,240"
}

interface InteractiveNorthStarProps {
    goals: Goal[];
    onGoalSelect: (goal: Goal) => void;
    activeGoalId?: string | null;
}

export function InteractiveNorthStar({ goals, onGoalSelect, activeGoalId }: InteractiveNorthStarProps) {
    // Main Star Animation
    const starScale = useSharedValue(1);
    const starOpacity = useSharedValue(1);

    // Entry Animation: Float up from tab bar area
    const containerY = useSharedValue(200);

    useEffect(() => {
        // Entry
        containerY.value = withSpring(0, { damping: 14, stiffness: 70 });

        // Breathing
        starScale.value = withRepeat(
            withTiming(1.1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
        starOpacity.value = withRepeat(
            withTiming(0.8, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, [containerY, starOpacity, starScale]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: containerY.value }]
    }));

    const animatedStarStyle = useAnimatedStyle(() => ({
        transform: [{ scale: starScale.value }],
        opacity: starOpacity.value
    }));

    // Calculate positions memoized
    const goalPositions = useMemo(() => {
        return goals.map((goal, index) => getGoalPosition(index, goals.length));
    }, [goals]);

    return (
        <Animated.View style={[styles.container, animatedContainerStyle]}>
            {/* Connection Lines */}
            {goals.map((goal, index) => {
                const pos = goalPositions[index];
                const isActive = goal.id === activeGoalId;
                return (
                    <View key={`line-${goal.id}`} style={[styles.connectionLine, {
                        height: pos.dist,
                        transform: [
                            { translateX: pos.x / 2 },
                            { rotate: `${Math.atan2(pos.x, pos.dist) * -1}rad` }
                        ],
                        opacity: isActive ? 0.8 : 0.2
                    }]} />
                );
            })}

            {/* Main North Star */}
            <Pressable onPress={() => { }} style={styles.mainStarContainer}>
                <Animated.View style={[styles.starWrapper, animatedStarStyle]}>
                    <NorthStarIcon size={80} color={Colors.aurora.green} withGlow />
                </Animated.View>
                <ThemedText style={styles.mainLabel}>MY NORTH STAR</ThemedText>
            </Pressable>

            {/* Orbiting Goals */}
            {goals.map((goal, index) => {
                const pos = goalPositions[index];
                return (
                    <GoalNode
                        key={goal.id}
                        goal={goal}
                        x={pos.x}
                        y={pos.dist}
                        index={index}
                        isSelected={goal.id === activeGoalId}
                        onPress={() => onGoalSelect(goal)}
                    />
                )
            })}
        </Animated.View>
    );
}

// Helper to calculate dynamic positions
function getGoalPosition(index: number, total: number) {
    // Dynamic spread based on total items
    // If fewer items, spread wider to fill space? 
    // If many items, we need to be careful of overlap.

    // Spread across ~160 degrees
    const spreadAngle = Math.PI * 0.9;
    const startAngle = (Math.PI - spreadAngle) / 2; // balanced

    const angleStep = total > 1 ? spreadAngle / (total - 1) : 0;
    const angle = total === 1 ? Math.PI / 2 : startAngle + (index * angleStep);

    // Vary distance to create layered/cloud effect
    const baseDist = 130;
    const dist = baseDist + (index % 2 === 0 ? 0 : 50);

    // Invert X because angle 0 is RIGHT, PI is LEFT. We want PI/2 is DOWN.
    // Actually simpler: 
    // angle 0 = right
    // angle PI/2 = down
    // angle PI = left
    // We want angles from, say, PI/6 (30deg, right-ish) to 5/6 PI (150deg, left-ish).
    // Let's use simple sin/cos logic where 0 is DOWN for easy mental model?
    // No, standard trig: X = cos(a), Y = sin(a).
    // We want Y positive (down). So angles in PI/6 to 5/6 PI range work perfectly.

    const x = Math.cos(angle) * dist * 1.8; // Wider X spread
    const y = Math.sin(angle) * dist;

    return { x, dist: y };
}

function GoalNode({ goal, x, y, onPress, index, isSelected }: { goal: Goal, x: number, y: number, onPress: () => void, index: number, isSelected: boolean }) {
    const scale = useSharedValue(0);

    useEffect(() => {
        scale.value = withDelay(index * 100, withSpring(1));
    }, [index, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: isSelected ? withSpring(1.2) : scale.value },
            { translateX: x },
            { translateY: y }
        ] as any
    }));

    // Brightness/Opacity based on progress or selection
    // High progress = Brighter color / Higher opacity
    const baseOpacity = 0.5 + (goal.progress * 0.5);
    const activeOpacity = isSelected ? 1 : baseOpacity;
    const borderColor = isSelected ? Colors.aurora.green : `rgba(255,255,255,${activeOpacity * 0.5})`;

    return (
        <Animated.View style={[styles.nodeContainer, animatedStyle]}>
            <Pressable onPress={onPress} style={[styles.nodeBubble, { borderColor, opacity: activeOpacity }]}>
                <View style={[
                    styles.nodeDot,
                    {
                        backgroundColor: goal.color || Colors.aurora.cyan,
                        shadowColor: goal.color || Colors.aurora.cyan,
                        shadowOpacity: goal.progress, // Glow more if more progress
                        shadowRadius: 10
                    }
                ]} />
                <ThemedText style={styles.nodeLabel}>{goal.label}</ThemedText>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 500,
        width: '100%',
        alignItems: 'center',
        paddingTop: 80,
    },
    mainStarContainer: {
        alignItems: 'center',
        zIndex: 10,
    },
    starWrapper: {
        marginBottom: 12,
        shadowColor: Colors.aurora.green,
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    mainLabel: {
        fontSize: 12,
        letterSpacing: 2,
        color: Colors.aurora.green,
        fontWeight: '700',
    },
    connectionLine: {
        position: 'absolute',
        top: 120, // Approx center of star
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.3)', // brighter lines
        zIndex: 0,
        transformOrigin: 'top center'
    },
    nodeContainer: {
        position: 'absolute',
        top: 120,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    nodeBubble: {
        backgroundColor: 'rgba(10,10,10,0.9)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4
    },
    nodeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    nodeLabel: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },
});
