/**
 * CSV Parser for Singapore Bank Statements
 * 
 * Supports:
 * - DBS/POSB: Date, Description, Debit, Credit, Balance
 * - OCBC: Date, Description, Withdrawals, Deposits, Balance
 * - UOB: Date, Description, Debit, Credit
 * 
 * Returns parsed transactions in standard format for instant processing.
 * NO AI NEEDED — parsing is instant (<100ms).
 */

export interface ParsedTransaction {
    date: string;          // YYYY-MM-DD
    description: string;
    amount: number;        // Negative = expense, Positive = income
    category: string;
    currency: string;
    balance?: number | null;
}

export interface CSVParseResult {
    success: boolean;
    transactions: ParsedTransaction[];
    bankDetected: string | null;
    opening_balance: number | null;
    closing_balance: number | null;
    error?: string;
}

/**
 * Main entry point - detect bank and parse CSV
 */
export function parseCSV(csvContent: string): CSVParseResult {
    try {
        const lines = csvContent.trim().split(/\r?\n/);
        if (lines.length < 2) {
            return { success: false, transactions: [], bankDetected: null, opening_balance: null, closing_balance: null, error: 'CSV has no data rows' };
        }

        // Detect bank format from header
        const header = lines[0].toLowerCase();

        if (header.includes('dbs') || (header.includes('debit') && header.includes('credit') && header.includes('balance'))) {
            return parseDBSFormat(lines);
        }

        if (header.includes('ocbc') || (header.includes('withdrawals') && header.includes('deposits'))) {
            return parseOCBCFormat(lines);
        }

        if (header.includes('uob') || header.includes('transaction date')) {
            return parseUOBFormat(lines);
        }

        // Fallback: try generic CSV format
        return parseGenericFormat(lines);
    } catch (e) {
        return {
            success: false,
            transactions: [],
            bankDetected: null,
            opening_balance: null,
            closing_balance: null,
            error: e instanceof Error ? e.message : 'Unknown parsing error'
        };
    }
}

/**
 * Parse DBS/POSB CSV format
 * Typical columns: Date, Description, Debit, Credit, Balance
 */
function parseDBSFormat(lines: string[]): CSVParseResult {
    const transactions: ParsedTransaction[] = [];
    let opening_balance: number | null = null;
    let closing_balance: number | null = null;

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 4) continue;

        const date = parseDate(cols[0]);
        const description = cols[1]?.trim() || '';
        const debit = parseAmount(cols[2]);
        const credit = parseAmount(cols[3]);
        const balance = cols.length > 4 ? parseAmount(cols[4]) : null;

        if (!date || (!debit && !credit && debit !== 0 && credit !== 0)) continue;

        // First row with balance = opening
        if (opening_balance === null && balance !== null) {
            opening_balance = balance + debit - credit;
        }

        // Track last balance as closing
        if (balance !== null) {
            closing_balance = balance;
        }

        const amount = credit > 0 ? credit : -debit;

        transactions.push({
            date,
            description,
            amount,
            category: categorizeTransaction(description),
            currency: 'SGD',
            balance,
        });
    }

    return {
        success: transactions.length > 0,
        transactions,
        bankDetected: 'DBS',
        opening_balance,
        closing_balance,
    };
}

/**
 * Parse OCBC CSV format
 * Typical columns: Date, Description, Withdrawals, Deposits, Balance
 */
function parseOCBCFormat(lines: string[]): CSVParseResult {
    const transactions: ParsedTransaction[] = [];
    let opening_balance: number | null = null;
    let closing_balance: number | null = null;

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 4) continue;

        const date = parseDate(cols[0]);
        const description = cols[1]?.trim() || '';
        const withdrawal = parseAmount(cols[2]);
        const deposit = parseAmount(cols[3]);
        const balance = cols.length > 4 ? parseAmount(cols[4]) : null;

        if (!date) continue;

        if (opening_balance === null && balance !== null) {
            opening_balance = balance + withdrawal - deposit;
        }
        if (balance !== null) {
            closing_balance = balance;
        }

        const amount = deposit > 0 ? deposit : -withdrawal;
        if (amount === 0) continue;

        transactions.push({
            date,
            description,
            amount,
            category: categorizeTransaction(description),
            currency: 'SGD',
            balance,
        });
    }

    return {
        success: transactions.length > 0,
        transactions,
        bankDetected: 'OCBC',
        opening_balance,
        closing_balance,
    };
}

/**
 * Parse UOB CSV format
 * Typical columns: Transaction Date, Description, Card Member, Amount
 */
function parseUOBFormat(lines: string[]): CSVParseResult {
    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 3) continue;

        const date = parseDate(cols[0]);
        const description = cols[1]?.trim() || '';
        // UOB amount is typically in last meaningful column
        const amountStr = cols[cols.length - 1] || cols[2];
        const amount = parseAmount(amountStr);

        if (!date || amount === 0) continue;

        transactions.push({
            date,
            description,
            amount: -Math.abs(amount), // UOB credit card = expenses
            category: categorizeTransaction(description),
            currency: 'SGD',
            balance: null,
        });
    }

    return {
        success: transactions.length > 0,
        transactions,
        bankDetected: 'UOB',
        opening_balance: null,
        closing_balance: null,
    };
}

/**
 * Generic CSV parser for unknown formats
 */
function parseGenericFormat(lines: string[]): CSVParseResult {
    const transactions: ParsedTransaction[] = [];
    const header = lines[0].toLowerCase();
    const cols = parseCSVLine(header);

    // Try to detect column indices
    let dateIdx = cols.findIndex(c => c.includes('date'));
    let descIdx = cols.findIndex(c => c.includes('desc') || c.includes('narration') || c.includes('particular'));
    let amountIdx = cols.findIndex(c => c.includes('amount') || c.includes('value'));

    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = 1;
    if (amountIdx === -1) amountIdx = 2;

    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < 3) continue;

        const date = parseDate(row[dateIdx] || '');
        const description = row[descIdx]?.trim() || '';
        const amount = parseAmount(row[amountIdx] || '');

        if (!date) continue;

        transactions.push({
            date,
            description,
            amount,
            category: categorizeTransaction(description),
            currency: 'SGD',
            balance: null,
        });
    }

    return {
        success: transactions.length > 0,
        transactions,
        bankDetected: 'Generic',
        opening_balance: null,
        closing_balance: null,
    };
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

/**
 * Parse date string to YYYY-MM-DD format
 */
function parseDate(dateStr: string): string {
    if (!dateStr) return '';

    const cleaned = dateStr.trim().replace(/"/g, '');

    // Try DD/MM/YYYY (SG format)
    const dmyMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Try YYYY-MM-DD
    const ymdMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
        return cleaned;
    }

    // Try DD MMM YYYY (e.g., "09 Jan 2024")
    const textMatch = cleaned.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
    if (textMatch) {
        const [, d, m, y] = textMatch;
        const monthMap: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const month = monthMap[m.toLowerCase()] || '01';
        return `${y}-${month}-${d.padStart(2, '0')}`;
    }

    return '';
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string): number {
    if (!amountStr) return 0;

    // Remove currency symbols, commas, quotes, spaces
    const cleaned = amountStr.replace(/[,$"'SGD\s]/gi, '').trim();

    // Handle parentheses for negative (accounting format)
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        return -parseFloat(cleaned.slice(1, -1)) || 0;
    }

    // Handle CR/DR suffix
    if (cleaned.toLowerCase().includes('cr')) {
        return Math.abs(parseFloat(cleaned.replace(/cr/gi, '')) || 0);
    }
    if (cleaned.toLowerCase().includes('dr')) {
        return -Math.abs(parseFloat(cleaned.replace(/dr/gi, '')) || 0);
    }

    return parseFloat(cleaned) || 0;
}

/**
 * Simple keyword-based categorization
 * Falls back to 'Other' if no match
 */
function categorizeTransaction(description: string): string {
    const desc = description.toLowerCase();

    // Food & Dining
    if (/grab\s*food|foodpanda|deliveroo|mcdonald|kfc|starbucks|kopitiam|fairprice|ntuc|cold storage|sheng siong|restaurant|cafe|bakery/.test(desc)) {
        return 'Food';
    }

    // Transport
    if (/grab|gojek|comfort|taxi|mrt|bus|ez-?link|simplygo|lta|parking|petrol|shell|esso|caltex/.test(desc)) {
        return 'Transport';
    }

    // Utilities
    if (/sp services|singtel|starhub|m1|circles|power|electricity|water|gas|internet/.test(desc)) {
        return 'Utilities';
    }

    // Subscriptions
    if (/netflix|spotify|youtube|apple|google|amazon prime|disney|hbo|microsoft|adobe/.test(desc)) {
        return 'Subscription';
    }

    // Shopping
    if (/shopee|lazada|amazon|taobao|uniqlo|h&m|zara|courts|best denki|harvey norman|ikea/.test(desc)) {
        return 'Shopping';
    }

    // Income
    if (/salary|payroll|bonus|dividend|interest|refund|cashback/.test(desc)) {
        return 'Income';
    }

    // Transfer
    if (/transfer|paynow|paylah|dbs|ocbc|uob|atm|withdrawal|deposit/.test(desc)) {
        return 'Transfer';
    }

    return 'Other';
}

/**
 * Check if file is likely a CSV
 */
export function isCSVFile(fileName: string, mimeType?: string): boolean {
    const ext = fileName.toLowerCase().split('.').pop();
    return ext === 'csv' || mimeType?.includes('csv') || mimeType?.includes('text/plain') || false;
}
