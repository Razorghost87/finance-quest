import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { getGuestToken } from '@/lib/guest-token';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

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

export default function SignUpScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleSignUp = async () => {
        setLoading(true);
        try {
            const supabase = ensureSupabaseConfigured();
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectTo,
                    skipBrowserRedirect: true
                }
            });

            if (error) throw error;

            if (data?.url) {
                const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
                if (res.type === 'success') {
                    const { url } = res;
                    const session = await createSessionFromUrl(url);

                    if (session) {
                        // Attempt Guest Migration silently
                        const guestToken = await getGuestToken();
                        if (guestToken) {
                            await supabase.rpc('migrate_guest_data', { guest_token_input: guestToken });
                        }
                        router.replace('/(tabs)');
                    }
                }
            }
        } catch (e: any) {
            Alert.alert('Google Sign-Up Failed', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async () => {
        const supabase = ensureSupabaseConfigured();
        if (!email || !password) {
            Alert.alert('Details required', 'Please enter both email and password.');
            return;
        }

        setLoading(true);
        try {
            // 1. Sign Up
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;
            if (!data.session) {
                Alert.alert('Check your email', 'Please confirm your email address to continue.');
                return;
            }

            // 2. Migrate Guest Data
            const guestToken = await getGuestToken();
            if (guestToken) {
                const { error: migrationError } = await supabase.rpc('migrate_guest_data', {
                    guest_token_input: guestToken
                });
                if (migrationError) {
                    console.error('Migration failed:', migrationError);
                    // Don't block sign up, but maybe warn?
                }
            }

            // 3. Navigate
            router.replace('/(tabs)');

        } catch (err: any) {
            Alert.alert('Sign Up Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.content}>
                <ThemedText type="title" style={styles.title}>Unlock North</ThemedText>
                <ThemedText style={styles.subtitle}>Save your financial trajectory.</ThemedText>

                <View style={styles.form}>

                    {/* Social Auth */}
                    <Pressable style={styles.googleButton} onPress={handleGoogleSignUp} disabled={loading}>
                        <ThemedText style={styles.googleButtonText}>Sign up with Google</ThemedText>
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

                    <Pressable style={styles.button} onPress={handleSignUp} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <ThemedText style={styles.buttonText}>Create Account</ThemedText>
                        )}
                    </Pressable>

                    <Pressable onPress={() => router.push('/auth/login')} style={styles.linkButton}>
                        <ThemedText style={styles.linkText}>Already have an account? Log In</ThemedText>
                    </Pressable>

                    <Pressable onPress={() => router.back()} style={styles.linkButton}>
                        <ThemedText style={styles.linkText}>Back to Guest Mode</ThemedText>
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
        marginBottom: 48,
        color: Colors.aurora.muted,
    },
    form: {
        gap: 24,
    },
    inputGroup: {
        gap: 8,
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
