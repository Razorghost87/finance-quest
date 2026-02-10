import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export default function AurosScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputText.trim(),
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            if (!supabase) throw new Error('Network unavailable');
            const { data, error } = await supabase.functions.invoke('agent-chat', {
                body: {
                    message: userMsg.content,
                    agentId: 'auros',
                    history: messages.slice(-5).map(m => ({ role: m.role, content: m.content })),
                },
            });

            if (error) throw error;

            const replyMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.reply,
                timestamp: Date.now(),
            };

            setMessages(prev => [...prev, replyMsg]);

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            Alert.alert('Connection Issue', `Auros is having trouble connecting right now.\n\nError: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]}>
            {/* Aurora Background Effect */}
            <LinearGradient
                colors={['rgba(0,255,163,0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.4 }}
            />

            <View style={[styles.header, { paddingTop: insets.top }]}>
                <View style={styles.headerContent}>
                    <View style={styles.avatar}>
                        <IconSymbol name="sparkles" size={20} color="#00FFA3" />
                    </View>
                    <Text style={[styles.headerTitle, { color: '#fff' }]}>Auros</Text>
                </View>
                <Text style={styles.headerSubtitle}>Personal Finance Consultant</Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.chatArea}
                contentContainerStyle={styles.chatContent}
                keyboardShouldPersistTaps="handled"
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <IconSymbol name="sparkles" size={40} color="#00FFA3" />
                        </View>
                        <Text style={styles.emptyTitle}>Financial Intelligence Ready.</Text>
                        <Text style={styles.emptyText}>I have analyzed your ledger. What would you like to know?</Text>

                        <View style={styles.suggestionContainer}>
                            <SuggestionChip text="Am I safe to spend?" onPress={() => { setInputText("Am I safe to spend?"); handleSend(); }} />
                            <SuggestionChip text="Analyze subscription risk" onPress={() => { setInputText("Analyze my subscription risk."); handleSend(); }} />
                            <SuggestionChip text="Project next month" onPress={() => { setInputText("Project next month's trajectory."); handleSend(); }} />
                        </View>
                    </View>
                ) : (
                    messages.map(msg => (
                        <View
                            key={msg.id}
                            style={[
                                styles.messageBubble,
                                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                            ]}
                        >
                            <Text style={[
                                styles.messageText,
                                { color: msg.role === 'user' ? '#000' : '#E0E0E0' }
                            ]}>{msg.content}</Text>
                        </View>
                    ))
                )}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#00FFA3" />
                    </View>
                )}
            </ScrollView>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={[styles.inputContainer, { backgroundColor: '#000', borderTopColor: '#1A1A1A' }]}>
                    <TextInput
                        style={[styles.input, { color: '#fff', backgroundColor: '#111' }]}
                        placeholder="Ask Auros..."
                        placeholderTextColor="#555"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: inputText.trim() ? '#00FFA3' : '#111' }]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || loading}
                    >
                        <IconSymbol name="arrow.up" size={20} color={inputText.trim() ? '#000' : '#444'} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

function SuggestionChip({ text, onPress }: { text: string, onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.suggestionChip} onPress={onPress}>
            <Text style={styles.suggestionText}>{text}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0,255,163,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,255,163,0.2)',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        marginLeft: 40,
    },
    chatArea: {
        flex: 1,
    },
    chatContent: {
        padding: 20,
        paddingBottom: 40,
    },
    emptyState: {
        marginTop: 80,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,255,163,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,255,163,0.1)',
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 10,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        fontSize: 16,
        lineHeight: 24,
    },
    messageBubble: {
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
        maxWidth: '85%',
    },
    userBubble: {
        backgroundColor: '#00FFA3',
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    assistantBubble: {
        backgroundColor: '#111',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#222',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 24,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    inputContainer: {
        padding: 16,
        borderTopWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        paddingHorizontal: 20,
        marginRight: 12,
        fontSize: 16,
    },
    sendButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    suggestionContainer: {
        marginTop: 32,
        width: '100%',
        gap: 12,
    },
    suggestionChip: {
        backgroundColor: 'rgba(0, 255, 163, 0.08)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 163, 0.15)',
        alignSelf: 'stretch',
    },
    suggestionText: {
        color: '#00FFA3',
        fontSize: 15,
        textAlign: 'center',
        fontWeight: '500',
    },
});
