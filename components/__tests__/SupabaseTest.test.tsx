
// process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
// process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'example-key';

describe('Supabase Client', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    });

    it('should create a client when credentials are present', () => {
        const { getSupabaseClient } = require('../../lib/supabase');
        const client = getSupabaseClient();
        expect(client).toBeDefined();
    });

    it('ensureSupabaseConfigured should return the client', () => {
        const { ensureSupabaseConfigured } = require('../../lib/supabase');
        const client = ensureSupabaseConfigured();
        expect(client).toBeDefined();
    });
});
