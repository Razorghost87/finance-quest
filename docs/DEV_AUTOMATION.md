# North Developer Automation

This repository uses automated agents to assist with development tasks. To maintain stability, we operate in a **Safe Mode** where agents are restricted to non-critical parts of the codebase.

## The Agent Workflow

1. **Issue Creation**: A human creates a GitHub Issue describing a task.
2. **Labeling**: Apply the `agent:ready` label to signal the agent to start.
3. **Dispatcher**: The agent dispatcher finds the issue, claims it (`agent:in-progress`), and creates a separate branch.
4. **Implementation**: The agent performs the task and creates a Pull Request (`agent:pr-open`).
5. **Review**:
   - If the task only touches **Safe Zones**, it is eligible for the `safe-to-merge` label.
   - If CI passes and `safe-to-merge` is applied, the PR will be auto-merged.
   - All other PRs require manual human approval.

## Safety Levels for Non-Coders

| Level | Area | Auto-Merge? | Human Review? |
| :--- | :--- | :--- | :--- |
| 🟢 **Safe** | UI text, styles, docs, colors | Yes | Optional |
| 🟡 **Neutral** | New components, app flow | No | Required |
| 🔴 **Danger** | Database, AI logic, Security | **Forbidden** | Manual Only |

### Why do we restrict the agent?
We want the agent to handle the repetitive "boring" stuff (fixing typos, adding content, styling cards) while a human (Michael) remains the sole guardian of the financial logic and data security.

---
*Last automated heartbeat:* 2026-02-10T19:23:04Z

Automation heartbeat: 2026-02-13T03:10:08Z (issue #3)
