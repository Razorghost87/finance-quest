# Swarm Task Catalog (Atomic Examples)

This file contains examples of well-structured atomic tasks for automated agents.

## 🟢 Safe Zone Tasks

### Task 1: Update Dashboard Inflow Wording
- **title**: Update Dashboard Inflow Wording
- **file_allowlist**: ["app/(tabs)/index.tsx"]
- **acceptance_criteria**: Change text "Total Inflow" to "Incoming Flow" for softer branding.
- **test_plan**: Open app dashboard, verify text change.
- **rollback_note**: Revert the string change in `index.tsx`.

### Task 2: Add Aurora Glow to Savings Ring
- **title**: Add Aurora Glow to Savings Ring
- **file_allowlist**: ["components/SavingsRateRing.tsx"]
- **acceptance_criteria**: Add a subtle `shadowOpacity: 0.3` and `shadowColor: Colors.aurora.green` to the ring container.
- **test_plan**: Upload statement, verify ring has glow on dashboard.
- **rollback_note**: Delete shadow style properties.

### Task 3: Clarify Privacy Doc
- **title**: Clarify Privacy Doc
- **file_allowlist**: ["docs/PRIVACY.md"]
- **acceptance_criteria**: Add a section explaining that PDF data never leaves the Supabase/OpenAI secure tunnel.
- **test_plan**: Read file and verify clarity.
- **rollback_note**: Delete the added section.

## 🟡 Neutral Zone Tasks

### Task 4: Create "Insight Tip" Component
- **title**: Create New Insight Tip Component
- **file_allowlist**: ["components/InsightTip.tsx"]
- **acceptance_criteria**: Create a small card component that accepts `text` and `icon` props.
- **test_plan**: Import into a test screen or storybook and verify rendering.
- **rollback_note**: Delete the new file.

### Task 5: Move Haptics to Shared Lib
- **title**: Standardize Haptic Utils
- **file_allowlist**: ["lib/haptics.ts", "app/processing.tsx"]
- **acceptance_criteria**: Consolidate haptic calls into `lib/haptics.ts` and update `processing.tsx` to use the helper.
- **test_plan**: Ensure vibration still triggers at progress milestones.
- **rollback_note**: Revert haptic calls back to inline.

## 🔴 Forbidden Zone Tasks (FOR REFERENCE ONLY - WILL FAIL AUTO-MERGE)

### Task 6: Add "Categorizing" SQL index
- **title**: Add Category Index
- **file_allowlist**: ["PIPELINE_STANDARDIZATION.sql"]
- **acceptance_criteria**: Create index on merchant column.
- **risk**: HIGH. Modifies schema source-of-truth.
- **rejection_reason**: Modifies forbidden path.

### Task 7: Update OpenAI Prompt
- **title**: Update Prompt Wording
- **file_allowlist**: ["supabase/functions/process-job/index.ts"]
- **acceptance_criteria**: Clarify merchant extraction rules.
- **risk**: HIGH. Modifies core AI logic.
- **rejection_reason**: Modifies forbidden path.

### Task 8: Change Progress Steps
- **title**: Add 50% Progress Step
- **file_allowlist**: ["lib/processing-progress.ts"]
- **acceptance_criteria**: Change the 45% step to 50%.
- **risk**: HIGH. Modifies protocol-locked semantics.
- **rejection_reason**: Logic violation (locked protocol).
