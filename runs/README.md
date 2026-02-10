# Agent Run Artifacts

The `runs/` directory stores the evidence and context for every automated task executed by the dispatcher.

## Directory Structure

```text
runs/<run_id>/
├── proposal.md      # Technical approach for the specific issue
├── tasks.md         # Checklist of sub-tasks performed
├── context.json     # Snapshot of the environment/repo state
├── evidence/        # Screenshots, logs, or test reports
└── logs/            # Full agent execution traces
```

This structure ensures that every change made by an automated agent is fully auditable and reversible.
