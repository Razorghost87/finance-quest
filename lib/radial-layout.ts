/**
 * Radial Layout Engine
 * 
 * Screen-adaptive positioning for the node constellation.
 * Guarantees: No cropping, no overlap, equal reachability.
 * 
 * Formula:
 * center = (screenWidth / 2, screenHeight / 2)
 * radius = min(screenWidth, screenHeight) * 0.32
 * 
 * Fixed angles (Phase 1):
 * - Income → 270° (top)
 * - Fixed → 0° (right)
 * - Flexible → 180° (left)
 * - Savings → 90° (bottom)
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Force node types (Phase 1 - fixed set)
 */
export type ForceNodeType = 'income' | 'fixed' | 'flexible' | 'savings';

/**
 * Get screen center point
 */
export function getCenter(): { x: number; y: number } {
    return {
        x: SCREEN_WIDTH / 2,
        y: SCREEN_HEIGHT / 2,
    };
}

/**
 * Get adaptive radius based on screen size
 */
export function getOrbitRadius(): number {
    return Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.32;
}

/**
 * Get star (center node) radius
 */
export function getStarRadius(): number {
    return Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.12;
}

/**
 * Get force node radius
 */
export function getNodeRadius(): number {
    return 36;
}

/**
 * Fixed angles for each force type (in degrees)
 * Positioned for visual balance and one-hand reachability
 */
export const FORCE_ANGLES: Record<ForceNodeType, number> = {
    income: 270,    // Top (12 o'clock)
    fixed: 0,       // Right (3 o'clock)
    flexible: 180,  // Left (9 o'clock)
    savings: 90,    // Bottom (6 o'clock)
};

/**
 * Convert degrees to radians
 */
function degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Calculate node position based on force type
 */
export function getNodePosition(
    forceType: ForceNodeType,
    centerX: number,
    centerY: number,
    radius: number
): { x: number; y: number } {
    const angle = degreesToRadians(FORCE_ANGLES[forceType]);
    return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
    };
}

/**
 * Get all force node positions
 */
export function getAllNodePositions(
    centerX: number,
    centerY: number,
    radius: number
): Record<ForceNodeType, { x: number; y: number }> {
    return {
        income: getNodePosition('income', centerX, centerY, radius),
        fixed: getNodePosition('fixed', centerX, centerY, radius),
        flexible: getNodePosition('flexible', centerX, centerY, radius),
        savings: getNodePosition('savings', centerX, centerY, radius),
    };
}

/**
 * Force node data structure
 */
export interface ForceNodeData {
    type: ForceNodeType;
    label: string;
    amount: number;
    impact: 'positive' | 'negative' | 'neutral';
    magnitude: number; // 0-1, affects line thickness
    insight: {
        statement: string;   // "This pulled you off course."
        magnitude: string;   // "Net impact: −$1,071"
        recovery: string;    // "Reducing this by 10% restores balance."
    };
}

/**
 * Generate force node data from financial totals
 */
export function generateForceNodes(totals: {
    inflow: number;
    outflow: number;
    netCashflow: number;
}): ForceNodeData[] {
    const { inflow, outflow, netCashflow } = totals;

    // Estimate breakdown (in real app, from actual categories)
    const fixedAmount = outflow * 0.4;
    const flexibleAmount = outflow * 0.5;
    const savingsAmount = netCashflow;

    const maxAmount = Math.max(inflow, outflow, Math.abs(netCashflow));

    return [
        {
            type: 'income',
            label: 'Income',
            amount: inflow,
            impact: inflow > 0 ? 'positive' : 'neutral',
            magnitude: inflow / maxAmount,
            insight: {
                statement: inflow > 0
                    ? 'This is propelling you forward.'
                    : 'No income detected.',
                magnitude: `+$${inflow.toLocaleString()}`,
                recovery: 'Increasing income expands your margin.',
            },
        },
        {
            type: 'fixed',
            label: 'Fixed',
            amount: fixedAmount,
            impact: 'neutral',
            magnitude: fixedAmount / maxAmount,
            insight: {
                statement: 'Committed obligations — stable force.',
                magnitude: `-$${Math.round(fixedAmount).toLocaleString()}`,
                recovery: 'Fixed costs are harder to change quickly.',
            },
        },
        {
            type: 'flexible',
            label: 'Flexible',
            amount: flexibleAmount,
            impact: flexibleAmount > inflow * 0.4 ? 'negative' : 'neutral',
            magnitude: flexibleAmount / maxAmount,
            insight: {
                statement: flexibleAmount > inflow * 0.4
                    ? 'This is pulling you off course.'
                    : 'Discretionary spending is balanced.',
                magnitude: `-$${Math.round(flexibleAmount).toLocaleString()}`,
                recovery: 'Reducing here has the fastest impact.',
            },
        },
        {
            type: 'savings',
            label: savingsAmount >= 0 ? 'Savings' : 'Drift',
            amount: Math.abs(savingsAmount),
            impact: savingsAmount > 0 ? 'positive' : 'negative',
            magnitude: Math.abs(savingsAmount) / maxAmount,
            insight: {
                statement: savingsAmount >= 0
                    ? "Building margin — you're on course."
                    : 'Deficit is pulling you backward.',
                magnitude: savingsAmount >= 0
                    ? `+$${savingsAmount.toLocaleString()}`
                    : `-$${Math.abs(savingsAmount).toLocaleString()}`,
                recovery: savingsAmount >= 0
                    ? 'Keep this momentum.'
                    : 'Address flexible spending first.',
            },
        },
    ];
}

/**
 * Get visual properties for force impact
 */
export function getImpactVisuals(impact: 'positive' | 'negative' | 'neutral'): {
    color: string;
    glowColor: string;
} {
    switch (impact) {
        case 'positive':
            return { color: '#00FFA3', glowColor: 'rgba(0,255,163,0.3)' };
        case 'negative':
            return { color: '#FF4D4D', glowColor: 'rgba(255,77,77,0.3)' };
        case 'neutral':
        default:
            return { color: '#8E8E93', glowColor: 'rgba(142,142,147,0.2)' };
    }
}

/**
 * Calculate line thickness based on magnitude
 */
export function getLineThickness(magnitude: number): number {
    const min = 1;
    const max = 4;
    return min + magnitude * (max - min);
}

/**
 * Minimum touch target size (accessibility)
 */
export const MIN_TOUCH_TARGET = 48;
