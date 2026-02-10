/**
 * North Star Layout System V2
 * 
 * Responsive gravitational model with polar coordinates.
 * Rules:
 * - Star is always centered
 * - No clipping on any device
 * - Nodes placed via polar math
 * - Minimum 44px hit targets
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Calculate safe drawing area
 * Nothing should be placed beyond this radius
 */
export function getSafeRadius(): number {
    return Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.42;
}

/**
 * Get center point of screen
 * No offsets. Ever.
 */
export function getCenterPoint(): { x: number; y: number } {
    return {
        x: SCREEN_WIDTH / 2,
        y: SCREEN_HEIGHT / 2,
    };
}

/**
 * Calculate North Star diameter
 * Responsive to screen size
 */
export function getStarDiameter(): number {
    return Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.18;
}

/**
 * Calculate star radius (half of diameter)
 */
export function getStarRadius(): number {
    return getStarDiameter() / 2;
}

/**
 * Linear interpolation helper
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Calculate node position using polar coordinates
 * 
 * @param index - Node index in the constellation
 * @param totalNodes - Total number of nodes
 * @param confidenceFactor - 0-1 value affecting orbit radius
 * @returns {x, y} position relative to screen
 */
export function calculateNodePosition(
    index: number,
    totalNodes: number,
    confidenceFactor: number = 0.5
): { x: number; y: number } {
    const center = getCenterPoint();
    const starRadius = getStarRadius();
    const safeRadius = getSafeRadius();

    // Angle evenly distributed around the circle
    const angle = (2 * Math.PI / totalNodes) * index - Math.PI / 2; // Start from top

    // Radius interpolated based on confidence
    // Higher confidence = nodes closer to star
    const minRadius = starRadius * 1.6;
    const maxRadius = safeRadius * 0.85;
    const radius = lerp(minRadius, maxRadius, 1 - confidenceFactor);

    return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
    };
}

/**
 * Get all node positions for a constellation
 */
export function getConstellationPositions(
    nodeCount: number,
    confidenceFactor: number = 0.5
): Array<{ x: number; y: number; angle: number }> {
    const positions = [];

    for (let i = 0; i < nodeCount; i++) {
        const pos = calculateNodePosition(i, nodeCount, confidenceFactor);
        const angle = (2 * Math.PI / nodeCount) * i - Math.PI / 2;
        positions.push({ ...pos, angle });
    }

    return positions;
}

/**
 * Check if a point is within safe bounds
 */
export function isWithinSafeBounds(x: number, y: number): boolean {
    const center = getCenterPoint();
    const safeRadius = getSafeRadius();

    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= safeRadius;
}

/**
 * Clamp a position to safe bounds
 */
export function clampToSafeBounds(x: number, y: number): { x: number; y: number } {
    const center = getCenterPoint();
    const safeRadius = getSafeRadius();

    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= safeRadius) {
        return { x, y };
    }

    // Scale back to safe radius
    const scale = safeRadius / distance;
    return {
        x: center.x + dx * scale,
        y: center.y + dy * scale,
    };
}

/**
 * Direction states for North Star
 */
export type Direction = 'improving' | 'stable' | 'declining';

/**
 * Get visual properties based on direction
 */
export function getDirectionVisuals(direction: Direction): {
    primaryColor: string;
    secondaryColor: string;
    glowIntensity: number;
    motionType: 'pulse' | 'orbit' | 'pull';
} {
    switch (direction) {
        case 'improving':
            return {
                primaryColor: '#00FFA3', // Green
                secondaryColor: '#00D2FF', // Cyan
                glowIntensity: 1.0,
                motionType: 'pulse',
            };
        case 'stable':
            return {
                primaryColor: '#00D2FF', // Blue
                secondaryColor: '#A78BFA', // Purple
                glowIntensity: 0.7,
                motionType: 'orbit',
            };
        case 'declining':
            return {
                primaryColor: '#FFC107', // Amber
                secondaryColor: '#FF4D4D', // Red
                glowIntensity: 0.5,
                motionType: 'pull',
            };
    }
}

/**
 * Calculate direction from financial data
 */
export function calculateDirection(
    netCashflow: number,
    inflow: number,
    previousNet?: number
): Direction {
    const savingsRate = inflow > 0 ? (netCashflow / inflow) * 100 : 0;

    // Improving: positive net AND good savings rate
    if (netCashflow > 0 && savingsRate >= 10) {
        return 'improving';
    }

    // Declining: negative net
    if (netCashflow < 0) {
        return 'declining';
    }

    // Stable: everything else (positive but low savings, or break-even)
    return 'stable';
}

/**
 * Node sizing based on importance
 */
export function getNodeSize(importance: number = 0.5): number {
    const baseSize = 28;
    const maxScale = 1.5;
    return baseSize * lerp(1, maxScale, importance);
}

/**
 * Ensure minimum touch target (accessibility)
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Get touch target padding needed
 */
export function getTouchPadding(visualSize: number): number {
    if (visualSize >= MIN_TOUCH_TARGET) return 0;
    return (MIN_TOUCH_TARGET - visualSize) / 2;
}
