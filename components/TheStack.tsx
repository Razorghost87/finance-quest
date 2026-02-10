
import { Colors } from '@/constants/theme';
import { northHaptics } from '@/lib/haptics';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';

import { ParticleBurst } from './ui/ParticleBurst';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export interface StackCard {
    id: string;
    type: 'insight' | 'transaction' | 'decision';
    title: string;
    body: string;
    action?: string;
    amount?: number;
    meta?: any;
}

interface TheStackProps {
    initialCards?: StackCard[];
}

export function TheStack({ initialCards = [] }: TheStackProps) {
    const [cards, setCards] = useState<StackCard[]>(initialCards);
    const [rewardTriggered, setRewardTriggered] = useState(false);

    // Update internal state if props change (re-hydration)
    React.useEffect(() => {
        if (initialCards.length > 0) {
            setCards(initialCards);
            setRewardTriggered(false);
        }
    }, [initialCards]);

    const onSwipeComplete = (direction: 'left' | 'right') => {
        northHaptics.success();
        // Remove the top card
        setCards((prev) => {
            const next = prev.slice(1);
            if (next.length === 0) {
                setRewardTriggered(true);
            }
            return next;
        });
    };

    if (cards.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <ParticleBurst trigger={rewardTriggered} />
                <IconSymbol name="checkmark.circle.fill" size={64} color={Colors.aurora.green} />
                <ThemedText style={styles.emptyText}>You&apos;re all caught up.</ThemedText>
            </View>
        );
    }

    // We render the cards in reverse order so the first one in the array is on top (z-index)
    // Actually, simpler: Render top card interactive, others just visuals below.
    // Let's render the top 2 cards.

    return (
        <View style={styles.container}>
            {cards.length > 1 && (
                <View style={[styles.cardContainer, styles.cardBehind]}>
                    <CardContent item={cards[1]} />
                </View>
            )}

            <SwipeableCard
                key={cards[0].id}
                item={cards[0]}
                onSwipe={onSwipeComplete}
            />
        </View>
    );
}

function SwipeableCard({ item, onSwipe }: { item: any, onSwipe: (dir: 'left' | 'right') => void }) {
    const translateX = useSharedValue(0);
    const rotate = useSharedValue(0);
    const scale = useSharedValue(1);

    const context = useSharedValue({ x: 0 });

    const gesture = Gesture.Pan()
        .onBegin(() => {
            context.value = { x: translateX.value };
            scale.value = withSpring(1.05);
            runOnJS(northHaptics.light)();
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;
            // Rotate based on translation
            rotate.value = interpolate(translateX.value, [-SCREEN_WIDTH, SCREEN_WIDTH], [-15, 15]);
        })
        .onEnd(() => {
            scale.value = withSpring(1);
            if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
                const direction = translateX.value > 0 ? 'right' : 'left';
                // Throw it off screen
                translateX.value = withSpring(direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5, {}, () => {
                    runOnJS(onSwipe)(direction);
                });
            } else {
                // Snap back
                translateX.value = withSpring(0);
                rotate.value = withSpring(0);
            }
        });

    const rStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { rotate: `${rotate.value}deg` },
                { scale: scale.value }
            ],
        };
    });

    const overlayRightStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateX.value, [0, SCREEN_WIDTH * 0.25], [0, 1]),
        };
    });

    const overlayLeftStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateX.value, [-SCREEN_WIDTH * 0.25, 0], [1, 0]),
        };
    });

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.cardContainer, rStyle]}>
                <CardContent item={item} />

                {/* Overlays for swipe feedback */}
                <Animated.View style={[styles.overlay, styles.overlayRight, overlayRightStyle]}>
                    <IconSymbol name="checkmark.circle.fill" size={64} color="#FFF" />
                </Animated.View>
                <Animated.View style={[styles.overlay, styles.overlayLeft, overlayLeftStyle]}>
                    <IconSymbol name="xmark.circle.fill" size={64} color="#FFF" />
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
}

function CardContent({ item }: { item: any }) {
    const isTransaction = item.type === 'transaction';

    return (
        <View style={styles.cardInner}>
            <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: isTransaction ? 'rgba(59,227,255,0.15)' : 'rgba(56,255,179,0.15)' }]}>
                    <IconSymbol
                        name={isTransaction ? "creditcard.fill" : "sparkles"}
                        size={16}
                        color={isTransaction ? Colors.aurora.cyan : Colors.aurora.green}
                    />
                    <ThemedText style={[styles.badgeText, { color: isTransaction ? Colors.aurora.cyan : Colors.aurora.green }]}>
                        {item.type.toUpperCase()}
                    </ThemedText>
                </View>
            </View>

            <View style={styles.cardBody}>
                <ThemedText type="subtitle" style={styles.cardTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.cardText}>{item.body}</ThemedText>
            </View>

            <View style={styles.cardFooter}>
                <ThemedText style={styles.hintText}>Swipe to resolve</ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 280,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 20,
    },
    cardContainer: {
        position: 'absolute',
        width: SCREEN_WIDTH - 48,
        height: 240,
        backgroundColor: Colors.aurora.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.aurora.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    cardBehind: {
        transform: [{ scale: 0.95 }, { translateY: 10 }],
        opacity: 0.5,
        zIndex: -1,
    },
    cardInner: {
        flex: 1,
        padding: 24,
        justifyContent: 'space-between',
        overflow: 'hidden',
        borderRadius: 24, // Clip overlays
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        gap: 6,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cardBody: {
        gap: 8,
    },
    cardTitle: {
        fontSize: 28,
        lineHeight: 32,
        color: Colors.aurora.text,
    },
    cardText: {
        fontSize: 18,
        color: Colors.aurora.muted,
        lineHeight: 26,
    },
    cardFooter: {
        alignItems: 'center',
    },
    hintText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.3)',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    emptyContainer: {
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    emptyText: {
        fontSize: 18,
        color: Colors.aurora.muted,
        fontWeight: '600',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 24,
    },
    overlayRight: {
        backgroundColor: 'rgba(56,255,179,0.2)', // Green tint
    },
    overlayLeft: {
        backgroundColor: 'rgba(255,77,77,0.2)', // Red tint
    },
});
