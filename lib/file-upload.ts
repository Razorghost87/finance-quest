import * as FileSystem from "expo-file-system/legacy";

/**
 * Read file as ArrayBuffer (Expo Go safe - works on iOS + Android)
 * Uses base64 encoding which is slower but most stable in Expo Go
 * 
 * FIXES APPLIED:
 * 1. Use globalThis.atob consistently (not bare atob)
 * 2. Improved manual base64 decoder with proper padding handling
 * 3. Better error handling for invalid base64
 * 4. Proper ArrayBuffer creation (not view into larger buffer)
 * 5. Memory safety checks
 */
export async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    // Works in Expo Go for iOS + Android
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64 || base64.length === 0) {
      throw new Error("File appears to be empty");
    }

    // Validate base64 string (basic check)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64)) {
      throw new Error("Invalid base64 data received from file system");
    }

    // Decode base64 -> Uint8Array (Expo Go safe)
    // Use atob if available, otherwise decode manually
    let binaryString: string;

    try {
      // FIX: Use globalThis.atob consistently (not bare atob which might not exist)
      if (typeof globalThis.atob === 'function') {
        binaryString = globalThis.atob(base64);
      } else if (typeof atob === 'function') {
        // Fallback: try bare atob (some environments have it globally)
        binaryString = atob(base64);
      } else {
        // Manual base64 decode (fallback for environments without atob)
        binaryString = manualBase64Decode(base64);
      }
    } catch (decodeError) {
      throw new Error(`Base64 decoding failed: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
    }

    if (!binaryString || binaryString.length === 0) {
      throw new Error("Base64 decoding produced empty result");
    }

    // FIX: Create a proper ArrayBuffer (not a view into a larger buffer)
    // Convert binary string to Uint8Array, then create a new ArrayBuffer
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create a new ArrayBuffer with the exact size (not a view)
    const arrayBuffer = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(bytes);

    return arrayBuffer;
  } catch (error) {
    // Enhanced error messages
    if (error instanceof Error) {
      if (error.message.includes('No such file') || error.message.includes('ENOENT')) {
        throw new Error('File not found. Please select the file again.');
      }
      if (error.message.includes('permission') || error.message.includes('Permission')) {
        throw new Error('Permission denied. Please grant file access permission.');
      }
      if (error.message.includes('Unsupported URI scheme')) {
        throw new Error('Unsupported file location. Please pick the file again or try another file source.');
      }
    }
    throw error;
  }
}

/**
 * Manual base64 decoder (fallback when atob is not available)
 * Handles padding correctly and validates input
 */
function manualBase64Decode(base64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;

  // Clean base64 string (remove whitespace and invalid chars)
  const cleanedBase64 = base64.replace(/[^A-Za-z0-9\+\/\=]/g, '');

  // Base64 length must be multiple of 4 (with padding)
  if (cleanedBase64.length % 4 !== 0) {
    throw new Error(`Invalid base64 length: ${cleanedBase64.length} (must be multiple of 4)`);
  }

  while (i < cleanedBase64.length) {
    const enc1 = chars.indexOf(cleanedBase64.charAt(i++));
    const enc2 = chars.indexOf(cleanedBase64.charAt(i++));
    const enc3 = chars.indexOf(cleanedBase64.charAt(i++));
    const enc4 = chars.indexOf(cleanedBase64.charAt(i++));

    // Validate indices (should be >= 0, except padding which is 64)
    if (enc1 < 0 || enc2 < 0 || enc3 < 0 || enc4 < 0) {
      throw new Error('Invalid base64 character detected');
    }

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);

    // Handle padding: if enc3 is padding (=), don't add chr2
    if (enc3 !== 64) {
      output += String.fromCharCode(chr2);
    }

    // Handle padding: if enc4 is padding (=), don't add chr3
    if (enc4 !== 64) {
      output += String.fromCharCode(chr3);
    }
  }

  return output;
}

/**
 * Read file as plain text (UTF-8)
 * Used for CSV parsing
 */
export async function readFileAsText(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (error) {
    console.error('Error reading file as text:', error);
    throw new Error('Failed to read file contents');
  }
}

