import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// Hardcoded for North App - this should be in .env but for simplicity:
const redirectTo = makeRedirectUri({
    scheme: 'financequest',
    path: 'auth/callback',
});

const createSessionFromUrl = async (url: string) => {
    const { params, errorCode } = QueryParams.getQueryParams(url);

    if (errorCode) throw new Error(errorCode);
    const { access_token, refresh_token } = params;

    if (!access_token) return;

    const supabase = ensureSupabaseConfigured();
    const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
    });
    if (error) throw error;
    return data.session;
};

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const supabase = ensureSupabaseConfigured();
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectTo,
                    skipBrowserRedirect: true // We handle it manually
                }
            });

            if (error) throw error;

            if (data?.url) {
                const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
                if (res.type === 'success') {
                    const { url } = res;
                    await createSessionFromUrl(url);
                    // Session active, navigate
                    router.replace('/(tabs)');
                }
            }
        } catch (e: any) {
            Alert.alert('Google Sign-In Failed', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Details required', 'Please enter both email and password.');
            return;
        }

        setLoading(true);
        try {
            const supabase = ensureSupabaseConfigured();
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Navigate to main app
            router.replace('/(tabs)');

        } catch (err: any) {
            Alert.alert('Login Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.content}>
                <ThemedText type="title" style={styles.title}>Welcome Back</ThemedText>
                <ThemedText style={styles.subtitle}>Continue your journey North.</ThemedText>

                <View style={styles.form}>

                    {/* Social Auth */}
                    <Pressable style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}>
                        <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
                    </Pressable>

                    <View style={styles.divider}>
                        <View style={styles.line} />
                        <ThemedText style={styles.orText}>OR</ThemedText>
                        <View style={styles.line} />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Email</ThemedText>
                        <TextInput
                            style={styles.input}
                            placeholder="you@example.com"
                            placeholderTextColor={Colors.aurora.muted}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Password</ThemedText>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor={Colors.aurora.muted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <ThemedText style={styles.buttonText}>Log In</ThemedText>
                        )}
                    </Pressable>

                    <Pressable onPress={() => router.push('/auth/sign-up')} style={styles.linkButton}>
                        <ThemedText style={styles.linkText}>Don&apos;t have an account? Sign Up</ThemedText>
                    </Pressable>

                    <Pressable onPress={() => router.back()} style={styles.linkButton}>
                        <ThemedText style={styles.linkText}>Back</ThemedText>
                    </Pressable>
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.aurora.bg,
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
        color: Colors.aurora.text,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        color: Colors.aurora.muted,
    },
    form: {
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.aurora.text,
        marginLeft: 4,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: Colors.aurora.border,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: Colors.aurora.text,
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.aurora.border,
    },
    orText: {
        color: Colors.aurora.muted,
        fontSize: 14,
    },
    button: {
        backgroundColor: Colors.aurora.cyan,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
    linkButton: {
        alignItems: 'center',
        padding: 12,
    },
    linkText: {
        color: Colors.aurora.muted,
        textDecorationLine: 'underline',
    },
});
