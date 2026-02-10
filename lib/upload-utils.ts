/**
 * NORTH Upload Utilities
 * Retry logic, validation, and trace ID generation
 */

// Generate unique trace ID for observability
export function generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts?: number;
        baseDelayMs?: number;
        onRetry?: (attempt: number, error: Error) => void;
    } = {}
): Promise<T> {
    const { maxAttempts = 3, baseDelayMs = 1000, onRetry } = options;

    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if retry is worthwhile
            const isRetryable = isRetryableError(lastError);

            if (attempt === maxAttempts || !isRetryable) {
                throw lastError;
            }

            // Exponential backoff: 1s, 2s, 4s...
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.warn(`⚠️ Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`, lastError.message);

            if (onRetry) {
                onRetry(attempt, lastError);
            }

            await sleep(delay);
        }
    }

    throw lastError;
}

function isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('timeout')) return true;
    if (message.includes('fetch failed') || message.includes('aborted')) return true;

    // Server errors (5xx)
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return true;
    if (message.includes('bad gateway') || message.includes('service unavailable')) return true;

    // Rate limiting
    if (message.includes('429') || message.includes('rate limit')) return true;

    return false;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Validate file before upload
export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

export function validateFileBeforeUpload(
    uri: string | null | undefined,
    fileName: string | null | undefined,
    mimeType: string | null | undefined,
    fileSize?: number
): FileValidationResult {
    // Check URI exists
    if (!uri || uri.trim() === '') {
        return { valid: false, error: 'No file selected' };
    }

    // Check filename
    if (!fileName || fileName.trim() === '') {
        return { valid: false, error: 'Invalid file name' };
    }

    // Check mime type
    const validMimes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/heic',
        'image/heif',
    ];

    const normalizedMime = (mimeType || '').toLowerCase();
    const isValidMime = validMimes.some(m => normalizedMime.includes(m.split('/')[1])) ||
        normalizedMime.startsWith('image/') ||
        normalizedMime === 'application/pdf';

    if (!isValidMime && mimeType) {
        return { valid: false, error: `Unsupported file type: ${mimeType}. Please use PDF or images.` };
    }

    // Check file size if provided
    if (fileSize !== undefined) {
        const maxMobileSize = 12 * 1024 * 1024; // 12MB
        if (fileSize > maxMobileSize) {
            const sizeMB = Math.round(fileSize / 1024 / 1024);
            return { valid: false, error: `File too large (${sizeMB}MB). Maximum is 12MB.` };
        }

        if (fileSize === 0) {
            return { valid: false, error: 'File appears to be empty' };
        }
    }

    return { valid: true };
}
