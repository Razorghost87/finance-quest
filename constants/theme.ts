/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#FFFFFF',
    background: '#000000', // Void
    tint: '#00FFA3', // Aurora Green
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#00FFA3',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000', // Void
    tint: '#00FFA3', // Aurora Green
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#00FFA3',
  },
  aurora: {
    bg: '#000000',
    card: '#0E0E0E', // Void Surface
    border: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    muted: '#8E8E93',
    faint: 'rgba(255,255,255,0.45)',
    cyan: '#00D2FF', // Secondary Aurora
    green: '#00FFA3', // Primary Aurora
    purple: '#A78BFA',
    red: '#FF4D4D',
    yellow: '#FFC107', // Amber/Warning
  }
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
