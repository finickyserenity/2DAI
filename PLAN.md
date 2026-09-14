# 2Dai 3.0 Product Plan

## Product principles

- Local-first: every normal action works without a network connection.
- Fast capture: adding a task requires only a title. Useful syntax is inferred and removed from the stored title.
- Behavior over configuration: defaults should adapt from completions, delays, skips, and start times before asking for manual setup.
- Honest day boundaries: actions apply to the active day until the explicit **Start new day** item is completed.
- Quiet interface: task text and complete/delay/skip controls remain visually primary.

## Phase 1: local PWA foundation

- [x] Installable Vite/React PWA with automatic service-worker updates
- [x] Typed IndexedDB storage for lists, tasks, events, and settings
- [x] Today list ordered by preferred time and task position
- [x] Complete, delay one day, and skip occurrence actions
- [x] Explicit active-day rollover
- [x] Quick entry with time inference (`2:30p`, `at 9am`)
- [x] Task options for list, effort, interval, fixed schedule, time, and archive
- [x] Week and Month views that exclude daily-repeat noise
- [ ] Undo for the most recent task action
- [ ] Add, rename, reorder, and archive lists
- [ ] Reorder Today tasks and preserve learned order
- [ ] Start/stop duration tracking
- [ ] Date/week/season range rules
- [ ] Accessibility and cross-browser acceptance pass

## Phase 2: adaptive scheduling

- [ ] Learn typical completion order by list and task history
- [ ] Suggest effort from observed duration and skip/delay behavior
- [ ] Infer recurrence from repeated completions
- [ ] Parse richer capture syntax for intervals and ranges
- [ ] Surface inferred changes as reversible suggestions
- [ ] Add a workload summary for day, week, and month

## Phase 3: durable synchronization

- [ ] Define stable device IDs, revision IDs, and append-only change records
- [ ] Add a local SQLite adapter where platform support allows it
- [ ] Keep IndexedDB as the browser fallback behind the repository boundary
- [ ] Build an authenticated self-hosted sync API
- [ ] Encrypt transport and server backups; document threat model
- [ ] Implement resumable push/pull synchronization and tombstones
- [ ] Define deterministic conflict handling per field and event
- [ ] Add export, import, backup verification, and account deletion

## Phase 4: shared lists

- [ ] Invite family members to a specific list only
- [ ] Roles: owner, editor, and viewer
- [ ] Shared task assignment and activity history
- [ ] Offline edits with visible conflict resolution
- [ ] Notifications with per-list controls

## Decisions to validate

1. Whether a delayed task moves exactly one day or learns a preferred delay.
2. Whether skipping a non-repeating task archives it or reschedules it for tomorrow.
3. Whether a new day can be started retroactively for more than one missed date.
4. How fixed-time tasks interact with manually reordered tasks.
5. Whether effort is a simple 1-10 value, duration-derived, or both.
6. Which server stack and authentication mechanism the self-hosted sync API should use.

## Current data model

- `lists`: local organization and display order.
- `tasks`: current scheduling projection and user-editable options.
- `events`: append-only complete/delay/skip history with an effective day.
- `settings`: active day and future device preferences.

The event history is intentionally retained even though Phase 1 updates each task's next due date directly. It provides the input needed for adaptive scheduling and eventual conflict-aware synchronization.