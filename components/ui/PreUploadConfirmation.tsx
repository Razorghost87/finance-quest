/**
 * Pre-Upload Confirmation Screen
 * 
 * Shows before upload starts to build trust.
 * "We'll analyze this for you"
 * 
 * No modals. No alerts. Calm confidence.
 */

import { Colors } from '@/constants/theme';
import { northHaptics } from '@/lib/haptics';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../themed-text';
import { AuroraBackground } from './AuroraBackground';

interface PreUploadConfirmationProps {
    fileName: string;
    fileSize: number; // bytes
    onConfirm: () => void;
    onCancel: () => void;
}

export function PreUploadConfirmation({
    fileName,
    fileSize,
    onConfirm,
    onCancel,
}: PreUploadConfirmationProps) {
    const insets = useSafeAreaInsets();

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Estimate processing time based on file size
    const estimatedTime = fileSize > 5 * 1024 * 1024
        ? '30–60 seconds'
        : '20–40 seconds';

    // Warning for large files
    const isLargeFile = fileSize > 5 * 1024 * 1024;

    return (
        <AuroraBackground>
            <View style={[styles.container, { paddingTop: insets.top + 40 }]}>

                {/* Header */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(400)}
                    style={styles.header}
                >
                    <View style={styles.iconContainer}>
                        <ThemedText style={styles.icon}>📄</ThemedText>
                    </View>
                    <ThemedText style={styles.title}>
                        We'll analyze this for you
                    </ThemedText>
                    <ThemedText style={styles.fileName} numberOfLines={1}>
                        {fileName}
                    </ThemedText>
                    <ThemedText style={styles.fileSize}>
                        {formatSize(fileSize)}
                    </ThemedText>
                </Animated.View>

                {/* Checklist */}
                <Animated.View
                    entering={FadeInDown.delay(200).duration(400)}
                    style={styles.checklist}
                >
                    <ChecklistItem
                        icon="🔒"
                        text="Secure & private — never shared"
                        delay={300}
                    />
                    <ChecklistItem
                        icon="🏦"
                        text="No bank login needed"
                        delay={400}
                    />
                    <ChecklistItem
                        icon="⏱️"
                        text={`Usually takes ${estimatedTime}`}
                        delay={500}
                    />
                    {isLargeFile && (
                        <ChecklistItem
                            icon="📊"
                            text="Large file — may take slightly longer"
                            delay={600}
                            warning
                        />
                    )}
                </Animated.View>

                {/* Actions */}
                <Animated.View
                    entering={FadeIn.delay(600).duration(400)}
                    style={[styles.actions, { paddingBottom: insets.bottom + 40 }]}
                >
                    <PrimaryButton
                        label="Begin Analysis"
                        onPress={onConfirm}
                    />
                    <SecondaryButton
                        label="Choose another file"
                        onPress={onCancel}
                    />
                </Animated.View>

            </View>
        </AuroraBackground>
    );
}

function ChecklistItem({
    icon,
    text,
    delay = 0,
    warning = false,
}: {
    icon: string;
    text: string;
    delay?: number;
    warning?: boolean;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).duration(300)}
            style={styles.checklistItem}
        >
            <ThemedText style={styles.checkIcon}>{icon}</ThemedText>
            <ThemedText style={[
                styles.checkText,
                warning && styles.checkTextWarning
            ]}>
                {text}
            </ThemedText>
        </Animated.View>
    );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
        scale.value = withSpring(0.96);
        northHaptics.light();
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1);
    }, []);

    const handlePress = useCallback(() => {
        northHaptics.medium();
        onPress();
    }, [onPress]);

    return (
        <Animated.View style={animatedStyle}>
            <Pressable
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.primaryButton}
            >
                <ThemedText style={styles.primaryButtonText}>{label}</ThemedText>
            </Pressable>
        </Animated.View>
    );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={styles.secondaryButton}>
            <ThemedText style={styles.secondaryButtonText}>{label}</ThemedText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    icon: {
        fontSize: 36,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.aurora.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    fileName: {
        fontSize: 14,
        color: Colors.aurora.muted,
        maxWidth: 250,
        textAlign: 'center',
    },
    fileSize: {
        fontSize: 12,
        color: Colors.aurora.faint,
        marginTop: 4,
    },
    checklist: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 20,
        gap: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    checkIcon: {
        fontSize: 18,
    },
    checkText: {
        fontSize: 15,
        color: Colors.aurora.text,
        flex: 1,
    },
    checkTextWarning: {
        color: Colors.aurora.yellow,
    },
    actions: {
        flex: 1,
        justifyContent: 'flex-end',
        gap: 12,
    },
    primaryButton: {
        backgroundColor: Colors.aurora.green,
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: Colors.aurora.green,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    primaryButtonText: {
        color: '#000',
        fontSize: 17,
        fontWeight: '700',
    },
    secondaryButton: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: Colors.aurora.muted,
        fontSize: 15,
    },
});
