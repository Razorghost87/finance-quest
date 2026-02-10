import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export function NorthStarIcon({
    size = 24,
    color = Colors.aurora.text,
    withGlow = false
}: {
    size?: number,
    color?: string,
    withGlow?: boolean
}) {
    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {withGlow && (
                <View style={[styles.glow, {
                    width: size * 2,
                    height: size * 2,
                    borderRadius: size,
                    backgroundColor: color,
                }]} />
            )}
            <MaterialCommunityIcons
                name="star-four-points"
                size={size}
                color={color}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
        opacity: 0.15,
        transform: [{ scale: 1.5 }],
    }
});
