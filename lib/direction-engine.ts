/**
 * Direction Engine
 * 
 * The financial orientation system core.
 * Everything resolves to: "Am I okay financially... or not?"
 * 
 * Output:
 * 1. Direction: On Course / Drifting / Off Course
 * 2. Confidence: How sure are we?
 * 3. Why: 1-2 lines only
 */

export type DirectionStatus = 'on-course' | 'drifting' | 'off-course';

export interface DirectionResult {
    status: DirectionStatus;
    confidence: number; // 0-100
    headline: string;   // "You're drifting slightly this month."
    subtext: string;    // "Spending outpaced income by $1,071."
    confidenceReason: string; // Why this confidence level
    primaryCause?: {
        category: string;
        impact: string;   // "42% of outflow"
        suggestion?: string; // "Reducing by 10% gets you back on course"
    };
}

export interface FinancialTotals {
    inflow: number;
    outflow: number;
    netCashflow: number;
}

export interface CategoryBreakdown {
    name: string;
    amount: number;
    percentage: number;
}

/**
 * Calculate direction from financial data
 * 
 * On Course: Positive cashflow AND savings rate >= 10%
 * Drifting: Positive but low savings, or slight deficit
 * Off Course: Significant deficit
 */
export function calculateDirection(
    totals: FinancialTotals,
    categories?: CategoryBreakdown[],
    confidence?: number
): DirectionResult {
    const { inflow, outflow, netCashflow } = totals;

    // Edge case: no income
    if (inflow <= 0) {
        return {
            status: 'off-course',
            confidence: confidence ?? 30,
            headline: 'No income detected this period.',
            subtext: 'Upload a statement with income data for accurate direction.',
            confidenceReason: 'Limited data available',
        };
    }

    const savingsRate = (netCashflow / inflow) * 100;
    const deficitAmount = Math.abs(netCashflow);

    // Find top spending category for causal explanation
    const topCategory = categories?.reduce((max, cat) =>
        cat.amount > (max?.amount ?? 0) ? cat : max, categories[0]
    );

    // DIRECTION LOGIC
    let status: DirectionStatus;
    let headline: string;
    let subtext: string;
    let primaryCause: DirectionResult['primaryCause'];

    if (netCashflow >= 0 && savingsRate >= 10) {
        // ON COURSE: Good savings rate
        status = 'on-course';
        headline = "You're on course this month.";
        subtext = `Saving ${savingsRate.toFixed(0)}% of income ($${netCashflow.toLocaleString()}).`;

    } else if (netCashflow >= 0 && savingsRate >= 0) {
        // DRIFTING: Positive but low savings
        status = 'drifting';
        headline = "You're drifting slightly.";
        subtext = savingsRate < 5
            ? `Only saving ${savingsRate.toFixed(0)}% — room to improve.`
            : `Saving ${savingsRate.toFixed(0)}% — workable, but tight.`;

        if (topCategory) {
            primaryCause = {
                category: topCategory.name,
                impact: `${topCategory.percentage.toFixed(0)}% of spending`,
                suggestion: `Reducing here by 10% would boost savings.`,
            };
        }

    } else if (netCashflow < 0 && deficitAmount < inflow * 0.1) {
        // DRIFTING: Small deficit (<10% of income)
        status = 'drifting';
        headline = "You're drifting this month.";
        subtext = `Spending outpaced income by $${deficitAmount.toLocaleString()}.`;

        if (topCategory) {
            const reductionNeeded = Math.ceil(deficitAmount / topCategory.amount * 100);
            primaryCause = {
                category: topCategory.name,
                impact: `${topCategory.percentage.toFixed(0)}% of outflow`,
                suggestion: reductionNeeded <= 20
                    ? `A ${reductionNeeded}% cut here gets you back on course.`
                    : undefined,
            };
        }

    } else {
        // OFF COURSE: Significant deficit
        status = 'off-course';
        headline = "You're off course this month.";
        subtext = `Spending exceeded income by $${deficitAmount.toLocaleString()}.`;

        if (topCategory) {
            primaryCause = {
                category: topCategory.name,
                impact: `${topCategory.percentage.toFixed(0)}% of outflow`,
            };
        }
    }

    // Confidence calculation
    const calculatedConfidence = confidence ?? calculateConfidence(totals, categories);
    const confidenceReason = getConfidenceReason(calculatedConfidence, categories?.length ?? 0);

    return {
        status,
        confidence: calculatedConfidence,
        headline,
        subtext,
        confidenceReason,
        primaryCause,
    };
}

/**
 * Calculate confidence based on data quality
 */
function calculateConfidence(
    totals: FinancialTotals,
    categories?: CategoryBreakdown[]
): number {
    let score = 50; // Base

    // Has income data
    if (totals.inflow > 0) score += 15;

    // Has outflow data
    if (totals.outflow > 0) score += 10;

    // Has category breakdown
    if (categories && categories.length > 0) {
        score += Math.min(categories.length * 3, 15);
    }

    // Numbers look reasonable (outflow < 3x income)
    if (totals.outflow < totals.inflow * 3) {
        score += 10;
    }

    return Math.min(score, 95);
}

/**
 * Get human-readable confidence reason
 */
function getConfidenceReason(confidence: number, categoryCount: number): string {
    if (confidence >= 80) {
        return 'Based on clear transaction data';
    }
    if (confidence >= 60) {
        return categoryCount > 3
            ? 'Good data with detailed categories'
            : 'Reasonable data, some categories unclear';
    }
    if (confidence >= 40) {
        return 'Limited transaction detail';
    }
    return 'Needs more data for accuracy';
}

/**
 * Get visual properties for direction status
 */
export function getDirectionVisuals(status: DirectionStatus): {
    emoji: string;
    label: string;
    primaryColor: string;
    secondaryColor: string;
    pulseSpeed: 'fast' | 'medium' | 'slow';
} {
    switch (status) {
        case 'on-course':
            return {
                emoji: '🟢',
                label: 'On Course',
                primaryColor: '#00FFA3',
                secondaryColor: '#00D2FF',
                pulseSpeed: 'slow', // Calm, confident
            };
        case 'drifting':
            return {
                emoji: '🟡',
                label: 'Drifting',
                primaryColor: '#FFC107',
                secondaryColor: '#FF9800',
                pulseSpeed: 'medium', // Attention needed
            };
        case 'off-course':
            return {
                emoji: '🔴',
                label: 'Off Course',
                primaryColor: '#FF4D4D',
                secondaryColor: '#FF1744',
                pulseSpeed: 'fast', // Urgent
            };
    }
}

/**
 * Phase 1 fixed nodes
 * These represent forces affecting direction
 */
export interface ForceNode {
    id: string;
    name: string;
    type: 'income' | 'fixed' | 'flexible' | 'drift';
    amount: number;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
}

export function calculateForceNodes(
    totals: FinancialTotals,
    categories?: CategoryBreakdown[]
): ForceNode[] {
    const nodes: ForceNode[] = [];

    // 1. Income node
    nodes.push({
        id: 'income',
        name: 'Income',
        type: 'income',
        amount: totals.inflow,
        impact: totals.inflow > 0 ? 'positive' : 'neutral',
        description: totals.inflow > 0
            ? `$${totals.inflow.toLocaleString()} this period`
            : 'No income detected',
    });

    // 2. Fixed obligations (estimate ~40% of outflow for now)
    const fixedAmount = totals.outflow * 0.4;
    nodes.push({
        id: 'fixed',
        name: 'Fixed Obligations',
        type: 'fixed',
        amount: fixedAmount,
        impact: 'neutral',
        description: `~$${Math.round(fixedAmount).toLocaleString()} committed`,
    });

    // 3. Flexible spending
    const flexibleAmount = totals.outflow * 0.5;
    nodes.push({
        id: 'flexible',
        name: 'Flexible Spending',
        type: 'flexible',
        amount: flexibleAmount,
        impact: flexibleAmount > totals.inflow * 0.4 ? 'negative' : 'neutral',
        description: `$${Math.round(flexibleAmount).toLocaleString()} discretionary`,
    });

    // 4. Savings/Drift
    const driftAmount = totals.netCashflow;
    nodes.push({
        id: 'drift',
        name: driftAmount >= 0 ? 'Savings' : 'Drift',
        type: 'drift',
        amount: Math.abs(driftAmount),
        impact: driftAmount > 0 ? 'positive' : 'negative',
        description: driftAmount >= 0
            ? `+$${driftAmount.toLocaleString()} saved`
            : `-$${Math.abs(driftAmount).toLocaleString()} deficit`,
    });

    return nodes;
}
