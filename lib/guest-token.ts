import * as SecureStore from 'expo-secure-store';

const GUEST_TOKEN_KEY = 'guest_token';

/**
 * Get or create a guest token
 * Returns existing token if found, creates new one if not
 */
export async function getOrCreateGuestToken(): Promise<string> {
  try {
    // Try to get existing token
    const existingToken = await SecureStore.getItemAsync(GUEST_TOKEN_KEY);
    if (existingToken) {
      return existingToken;
    }

    // Create new token
    const newToken = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    await SecureStore.setItemAsync(GUEST_TOKEN_KEY, newToken);
    return newToken;
  } catch (error) {
    console.error('Error managing guest token:', error);
    // Fallback: generate token but don't persist (for development)
    return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Get existing guest token (returns null if not found)
 */
export async function getGuestToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(GUEST_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting guest token:', error);
    return null;
  }
}

/**
 * Clear guest token (for testing or logout)
 */
export async function clearGuestToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GUEST_TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing guest token:', error);
  }
}

