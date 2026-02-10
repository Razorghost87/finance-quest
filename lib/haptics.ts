import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const northHaptics = {
    /**
     * Subtle click for navigation or minor selection
     */
    light: () => {
        if (isWeb) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    },

    /**
     * Standard feedback for button press or card activation
     */
    medium: () => {
        if (isWeb) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    },

    /**
     * Heavy thud for deleting, errors, or "heavy" monetary moves
     */
    heavy: () => {
        if (isWeb) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
    },

    /**
     * Positive reinforcement for saving or completing a task
     */
    success: () => {
        if (isWeb) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    },

    /**
     * Negative feedback for errors or warnings (or "spending too much")
     */
    error: () => {
        if (isWeb) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
    },

    /**
     * A "tick" sensation, good for sliders or scrolling
     */
    tick: () => {
        if (isWeb) return;
        Haptics.selectionAsync().catch(() => { });
    }
};
