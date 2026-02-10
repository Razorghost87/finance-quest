import { getSupabaseClient } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export type UserTier = 'guest' | 'north_star';

export function useUserTier(): UserTier {
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        // Listen for changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    return session ? 'north_star' : 'guest';
}
