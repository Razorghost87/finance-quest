/**
 * Insight Engine - Rules-based financial insight generator
 * Generates 3-5 human-readable insights from summary data
 */

export interface FinancialSummary {
    totals: {
        inflow: number;
        outflow: number;
        netCashflow: number;
    };
    topCategories?: { name: string; amount: number }[];
    subscriptions?: { merchant: string; amount: number; interval: string }[];
    reconciliation?: { ok: boolean; delta: number };
    confidence?: { score: number; grade: string };
}

export interface Insight {
    id: string;
    type: 'positive' | 'warning' | 'neutral' | 'action';
    icon: string;
    text: string;
    priority: number; // Lower = higher priority
}

/**
 * Generate insights from financial summary data
 * Uses only real numbers, no hallucinations
 */
export function generateInsights(summary: FinancialSummary | null): Insight[] {
    if (!summary?.totals) return [];

    const insights: Insight[] = [];
    const { inflow, outflow, netCashflow } = summary.totals;

    // Only generate if we have valid data
    if (inflow === 0 && outflow === 0) {
        return [{
            id: 'no-data',
            type: 'neutral',
            icon: '📊',
            text: 'Upload a statement to see your financial insights.',
            priority: 0,
        }];
    }

    // 1. Savings Rate Insight
    const savingsRate = inflow > 0 ? (netCashflow / inflow) * 100 : 0;
    if (savingsRate >= 30) {
        insights.push({
            id: 'savings-excellent',
            type: 'positive',
            icon: '🌟',
            text: `Excellent! You saved ${savingsRate.toFixed(0)}% of your income this month.`,
            priority: 1,
        });
    } else if (savingsRate >= 10) {
        insights.push({
            id: 'savings-good',
            type: 'positive',
            icon: '💪',
            text: `Good progress! You saved ${savingsRate.toFixed(0)}% of your income.`,
            priority: 2,
        });
    } else if (savingsRate >= 0) {
        insights.push({
            id: 'savings-low',
            type: 'warning',
            icon: '⚠️',
            text: `Your savings rate is ${savingsRate.toFixed(0)}%. Try to aim for at least 10%.`,
            priority: 2,
        });
    } else {
        insights.push({
            id: 'savings-negative',
            type: 'warning',
            icon: '🚨',
            text: `You spent $${Math.abs(netCashflow).toLocaleString()} more than you earned this month.`,
            priority: 1,
        });
    }

    // 2. Top Category Insight
    if (summary.topCategories && summary.topCategories.length > 0) {
        const topCat = summary.topCategories[0];
        const catPercent = outflow > 0 ? (topCat.amount / outflow) * 100 : 0;

        if (catPercent > 30) {
            insights.push({
                id: 'top-category',
                type: 'neutral',
                icon: '📍',
                text: `${topCat.name} is your top expense at $${topCat.amount.toLocaleString()} (${catPercent.toFixed(0)}% of spending).`,
                priority: 3,
            });
        }
    }

    // 3. Subscription Burden
    if (summary.subscriptions && summary.subscriptions.length > 0) {
        const totalSubs = summary.subscriptions.reduce((sum, s) => sum + s.amount, 0);
        const subPercent = outflow > 0 ? (totalSubs / outflow) * 100 : 0;

        if (totalSubs > 0) {
            insights.push({
                id: 'subscriptions',
                type: subPercent > 15 ? 'warning' : 'neutral',
                icon: '🔄',
                text: `Subscriptions total $${totalSubs.toLocaleString()}/month (${subPercent.toFixed(0)}% of spending).`,
                priority: 4,
            });
        }
    }

    // 4. Category Comparison (if 2+ categories)
    if (summary.topCategories && summary.topCategories.length >= 2) {
        const [first, second] = summary.topCategories;
        if (first.amount > second.amount * 2) {
            insights.push({
                id: 'category-comparison',
                type: 'neutral',
                icon: '📊',
                text: `You spent ${(first.amount / second.amount).toFixed(1)}× more on ${first.name} than ${second.name}.`,
                priority: 5,
            });
        }
    }

    // 5. Net Cashflow Summary
    if (netCashflow > 0) {
        insights.push({
            id: 'net-positive',
            type: 'positive',
            icon: '✅',
            text: `Net cashflow: +$${netCashflow.toLocaleString()}. You're in the green!`,
            priority: 6,
        });
    }

    // Sort by priority and return top 5
    return insights.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

/**
 * Generate a "money story" narrative
 */
export function generateMoneyStory(summary: FinancialSummary | null): string {
    if (!summary?.totals) return 'Upload a statement to see your money story.';

    const { inflow, outflow, netCashflow } = summary.totals;
    const savingsRate = inflow > 0 ? (netCashflow / inflow) * 100 : 0;

    if (netCashflow >= 0) {
        if (savingsRate >= 30) {
            return `Great month! You saved ${savingsRate.toFixed(0)}% of your income, putting away $${netCashflow.toLocaleString()}.`;
        } else if (savingsRate >= 10) {
            return `Solid month. You earned $${inflow.toLocaleString()}, spent $${outflow.toLocaleString()}, and saved ${savingsRate.toFixed(0)}%.`;
        } else {
            return `You broke even this month. Consider reducing expenses to build savings.`;
        }
    } else {
        return `This month was tough—you spent $${Math.abs(netCashflow).toLocaleString()} more than you earned. Let's find ways to cut back.`;
    }
}
