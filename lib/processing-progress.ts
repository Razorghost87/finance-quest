/**
 * Processing Progress System
 * 
 * Hybrid model: real backend progress + simulated visual ramp.
 * Never let progress stall visually.
 * 
 * Ramp curve:
 * - 0–30%: fast
 * - 30–80%: steady
 * - 80–95%: slow
 * - 100%: instant on done
 */

import { useEffect, useRef, useState } from 'react';

export interface ProcessingStage {
    id: string;
    label: string;
    minProgress: number;
    maxProgress: number;
}

/**
 * Canonical processing stages (V2 Blueprint)
 * These labels never change wording.
 */
export const PROCESSING_STAGES: ProcessingStage[] = [
    { id: 'queued', label: 'Preparing your statement...', minProgress: 0, maxProgress: 10 },
    { id: 'starting', label: 'Initializing analysis', minProgress: 5, maxProgress: 15 },
    { id: 'downloading', label: 'Securing your statement', minProgress: 15, maxProgress: 30 },
    { id: 'extracting', label: 'Reading transactions', minProgress: 30, maxProgress: 55 },
    { id: 'analyzing', label: 'Understanding your spending', minProgress: 55, maxProgress: 75 },
    { id: 'saving', label: 'Finalizing insights', minProgress: 75, maxProgress: 95 },
    { id: 'done', label: 'Ready', minProgress: 100, maxProgress: 100 },
];

/**
 * Get stage info by id
 */
export function getStageInfo(stageId: string): ProcessingStage {
    return PROCESSING_STAGES.find(s => s.id === stageId) || PROCESSING_STAGES[0];
}

/**
 * Get stage label
 */
export function getStageLabel(stageId: string): string {
    return getStageInfo(stageId).label;
}

/**
 * Time-based messages for expectation management
 */
export function getTimeMessage(elapsedSeconds: number): string {
    if (elapsedSeconds < 15) {
        return 'Usually takes under a minute';
    }
    if (elapsedSeconds < 30) {
        return 'Almost there — PDFs take slightly longer';
    }
    if (elapsedSeconds < 60) {
        return 'Still working — thanks for your patience';
    }
    return 'This is taking longer than usual...';
}

interface HybridProgressOptions {
    /** Backend-reported progress (0-100) */
    backendProgress: number;
    /** Current stage from backend */
    stage: string;
    /** Whether processing is complete */
    isDone: boolean;
    /** Whether there's an error */
    hasError: boolean;
}

interface HybridProgressState {
    /** Visual progress to display (0-100) */
    displayProgress: number;
    /** Current stage label */
    stageLabel: string;
    /** Time-based message */
    timeMessage: string;
    /** Elapsed seconds */
    elapsedSeconds: number;
}

/**
 * Hook for hybrid progress system
 * Combines real backend progress with simulated visual ramp
 */
export function useHybridProgress({
    backendProgress,
    stage,
    isDone,
    hasError,
}: HybridProgressOptions): HybridProgressState {
    const [displayProgress, setDisplayProgress] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const startTime = useRef(Date.now());
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    // Simulated progress ramp
    useEffect(() => {
        if (isDone) {
            setDisplayProgress(100);
            return;
        }

        if (hasError) {
            return; // Freeze on error
        }

        // Clear existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Simulated ramp (runs every 500ms)
        intervalRef.current = setInterval(() => {
            setDisplayProgress(prev => {
                // Get target from backend or stage
                const stageInfo = getStageInfo(stage);
                const targetProgress = Math.max(
                    backendProgress,
                    stageInfo.minProgress,
                    prev // Never go backwards
                );

                // Calculate ramp speed based on current progress
                let increment = 0.5; // Base increment

                if (prev < 30) {
                    increment = 1.5; // Fast start
                } else if (prev < 80) {
                    increment = 0.8; // Steady middle
                } else if (prev < 95) {
                    increment = 0.2; // Slow end
                } else {
                    increment = 0; // Hold at 95% until done
                }

                // Move toward target, but never exceed stage max (except done)
                const maxAllowed = isDone ? 100 : Math.min(stageInfo.maxProgress, 95);
                const next = Math.min(prev + increment, targetProgress, maxAllowed);

                return next;
            });
        }, 500);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [backendProgress, stage, isDone, hasError]);

    // Elapsed time counter
    useEffect(() => {
        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
            setElapsedSeconds(elapsed);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return {
        displayProgress,
        stageLabel: getStageLabel(stage),
        timeMessage: getTimeMessage(elapsedSeconds),
        elapsedSeconds,
    };
}

/**
 * Format progress for display
 */
export function formatProgress(progress: number): string {
    return `${Math.round(progress)}%`;
}
