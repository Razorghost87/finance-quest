import { Colors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.aurora.bg },
            animation: 'slide_from_right'
        }}>
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="login" />
        </Stack>
    );
}
