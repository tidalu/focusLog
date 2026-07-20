# FocusLog

## Software Requirements Specification

| Field                  | Value                                      |
| ---------------------- | ------------------------------------------ |
| Document version       | 1.0 Approved canonical baseline            |
| Project status         | Production validation                      |
| Document type          | Master Software Requirements Specification |
| Last updated           | 20 July 2026                               |
| Primary platforms      | Windows desktop and Android                |
| Specification language | English                                    |
| Classification         | Project-internal source of truth           |

---

# Implementation Directive

This is a greenfield software project.

The implementation agent must act as the project’s lead software architect, senior backend engineer, senior frontend engineer, senior Electron engineer, senior Flutter engineer, database engineer, DevOps engineer, security engineer, QA engineer, and technical writer.

Before writing production code, the implementation agent must:

1. Read this specification in full.
2. Design and document the complete system architecture.
3. Validate all requirements for internal consistency, technical feasibility, security, privacy, operability, and maintainability.
4. Identify missing requirements, ambiguous behavior, edge cases, failure modes, and technical risks.
5. Resolve ambiguities in favor of data integrity, predictable reminder behavior, offline availability, synchronization correctness, security, accessibility, and long-term maintainability.
6. Improve the proposed architecture when a clearly superior technical solution exists, while preserving the intended product behavior.
7. Record every material architectural change in an Architecture Decision Record and update the affected specification sections before implementation.
8. Define stable, versioned contracts between the backend, desktop application, Android application, persistence layers, reminder engine, synchronization engine, and deployment infrastructure.
9. Create an implementation plan divided into independently buildable, testable, and reviewable milestones.
10. Implement the complete production system.
11. Verify the delivered system against every applicable requirement and acceptance criterion in this specification.
12. Produce objective completion evidence, including build results, migration results, automated test results, packaging results, deployment validation, and completed documentation.

The implementation must prioritize correctness, code quality, reliability, maintainability, data integrity, security, privacy, accessibility, operational clarity, and long-term usability over speed of delivery.

The implementation must not consist of demo code, tutorial code, pseudocode, disposable scaffolding, temporary production mocks, incomplete placeholders, knowingly disabled validations, or proof-of-concept architecture presented as final software.

Temporary test doubles are permitted only inside automated tests or explicitly isolated development environments. They must never be used to conceal an incomplete production dependency.

The implementation agent must not report the project as complete while any mandatory requirement remains unimplemented, untested, undocumented, or unverified.

The final product must be production-grade software that can realistically be used every day for many years.

---

# 1. Document Purpose and Governance

## 1.1 Purpose

This Software Requirements Specification defines the functional, technical, operational, security, quality, documentation, packaging, and deployment requirements for FocusLog.

It is the authoritative source of truth for:

- Product behavior
- User experience
- System architecture
- Data ownership
- Database design
- API and event contracts
- Synchronization behavior
- Reminder behavior
- Offline operation
- Security and privacy
- Backup, restore, export, and import
- Testing and quality assurance
- Packaging and release management
- Deployment and operations
- Maintenance and support
- Acceptance criteria

All implementation decisions must comply with this specification unless an approved Architecture Decision Record documents a superior solution that preserves the intended functionality and updates all affected requirements.

## 1.2 Intended Audience

This document is intended for:

- Product owners
- Software architects
- Backend engineers
- Desktop engineers
- Flutter and Android engineers
- Database engineers
- DevOps and site-reliability engineers
- Security reviewers
- QA engineers
- Technical writers
- Coding agents
- Future maintainers

## 1.3 Specification Authority

When implementation behavior conflicts with this document, this specification takes precedence.

When requirements appear to conflict, the implementation team must apply the following priority order:

1. Prevent data loss, corruption, or unauthorized disclosure.
2. Preserve user safety and operating-system control.
3. Preserve offline usability.
4. Preserve synchronization correctness and idempotency.
5. Preserve predictable reminder behavior.
6. Preserve backward compatibility where explicitly required.
7. Choose the most secure, accessible, maintainable, and testable interpretation.
8. Record the decision in an Architecture Decision Record.
9. Update this specification so that the resolved behavior is no longer ambiguous.

No material product or architectural decision may exist only in source code, chat history, or the memory of a developer or coding agent.

## 1.4 Requirement Terminology

The terms **must**, **must not**, **should**, **should not**, and **may** are normative:

- **Must** indicates a mandatory requirement.
- **Must not** indicates prohibited behavior.
- **Should** indicates a recommended requirement that may be changed only with documented justification.
- **Should not** indicates behavior that is discouraged and requires documented justification if adopted.
- **May** indicates optional behavior.

## 1.5 Domain Terminology

- **Owner:** The individual who controls a FocusLog installation and owns its data.
- **Owner identity:** The persistent identity used to associate the owner’s devices and synchronized data. The implementation may use an account, a single-tenant owner record, or another approved ownership model.
- **Desktop application:** The Electron-based Windows application.
- **Android application:** The Flutter-based Android application.
- **Backend:** The server-side system responsible for ownership verification, device authorization, synchronization, shared persistence, reporting services, backup support, and shared business rules.
- **Check-in:** A user-authored activity entry created in response to a reminder or created manually.
- **Focus mode:** A reusable reminder configuration, such as Work, Deep Work, Study, Custom, or Adaptive.
- **Focus session:** A bounded or open-ended period during which a selected focus mode schedules and manages reminders.
- **Reminder:** A scheduled request for the user to record their current activity, thought, study task, work task, or break.
- **Reminder occurrence:** A single scheduled instance of a reminder within a focus session.
- **Overlay:** A high-priority reminder interface displayed by the desktop or Android application.
- **Device:** A registered Windows or Android installation with its own revocable credentials and synchronization state.
- **Device presence:** The device’s recent activity, connectivity, visibility, and suitability for receiving a reminder.
- **Offline queue:** A durable local collection of operations waiting to be synchronized with the backend.
- **Conflict:** A condition in which different devices modify the same logical record from different base versions before synchronization converges.
- **Tombstone:** A durable deletion marker used to synchronize deletion without unintentionally recreating deleted data.
- **Local-only mode:** An approved operating mode in which data remains on one device and backend synchronization is disabled.
- **Strict Reminder Mode:** The production reminder policy that requires a valid response before in-application dismissal while preserving accessibility and operating-system control.

## 1.6 Requirement Identification and Traceability

Beginning with the detailed requirements sections, every normative requirement must have a stable identifier.

Recommended prefixes include:

- `FR` — Functional requirement
- `NFR` — Non-functional requirement
- `DATA` — Data and persistence requirement
- `API` — REST API requirement
- `WS` — WebSocket or event-protocol requirement
- `DESK` — Desktop application requirement
- `MOB` — Android application requirement
- `REM` — Reminder-engine requirement
- `SYNC` — Synchronization requirement
- `SEC` — Security and privacy requirement
- `OPS` — Operations and deployment requirement
- `TEST` — Testing requirement
- `ACC` — Acceptance criterion

Identifiers must not be renumbered merely because requirements are reordered. Deprecated requirements must remain documented with their status and replacement reference.

Automated tests, manual test cases, and acceptance evidence must reference the requirement identifiers they verify.

## 1.7 Assumptions and Constraints

The initial specification assumes:

- FocusLog is primarily a personal, single-owner product.
- One owner may register multiple devices.
- The product may support both synchronized and local-only operation.
- Cross-device synchronization requires a secure ownership and device-authorization model, even if the product does not expose traditional multi-user collaboration features.
- Windows and Android platform restrictions must be respected.
- The application must never attempt to bypass operating-system security controls.
- Core capture and history features must remain usable during temporary backend or network outages.
- Detailed supported operating-system versions will be defined in the platform requirements and release policy.

---

# 2. Product Vision

## 2.1 Vision Statement

FocusLog is a personal focus-awareness and activity-journaling system that helps people understand how they actually spend their time by requesting short, meaningful written check-ins at deliberate intervals.

The application must work across Windows desktop and Android, remain useful without an internet connection, synchronize reliably between authorized devices, and provide clear historical views that help the owner identify productive periods, distractions, habits, missed intervals, and long-term patterns.

FocusLog is not a general-purpose project-management platform. Its primary purpose is to create a trustworthy, low-friction record of the owner’s real activity throughout the day.

## 2.2 Core Product Concept

The owner starts a focus session or activates an approved recurring schedule.

At configured intervals, FocusLog displays a reminder asking the owner to describe their current activity.

Example responses include:

- “Writing the monthly report”
- “Studying English vocabulary”
- “Scrolling through social media instead of working”
- “Planning tomorrow’s tasks”
- “Taking a lunch break”
- “Debugging synchronization errors”

Each response is stored with sufficient context to preserve its meaning and auditability, including:

- Stable entry identifier
- Owner identifier
- Device identifier
- Focus mode
- Focus session
- Reminder occurrence
- Scheduled reminder time
- Actual presentation time
- Submission time
- Response delay
- Completion state
- Time-zone context
- Optional tags
- Optional category
- Optional mood or focus score
- Creation and modification timestamps
- Synchronization version and state
- Deletion state, when applicable

Over time, FocusLog transforms these check-ins into searchable history, reports, charts, summaries, streaks, completion metrics, and calendar heatmaps.

## 2.3 Reminder Interaction Principles

Reminder behavior must be noticeable, predictable, recoverable, accessible, and compatible with platform security rules.

The system must support configurable reminder policies rather than embedding one irreversible behavior for every owner and every context.

### 2.3.1 Standard Reminder Mode

Standard Reminder Mode should provide:

- A visible reminder interface
- Immediate text entry
- Configurable snooze behavior
- Explicit skip behavior when allowed by policy
- Clear validation messages
- Keyboard-first desktop interaction
- Safe dismissal rules

### 2.3.2 Strict Reminder Mode

Strict Reminder Mode requires a valid response before the application dismisses
the reminder:

- **Windows:** The reminder overlay must remain visible until a valid response is
  submitted. There must be no UI control to dismiss, minimize, maximize, or close
  the overlay. The application should automatically regain focus if the overlay
  loses focus.
- **Android:** The reminder screen should remain the active foreground interface
  until a valid response is submitted, using the strongest platform-supported
  mechanisms (full-screen intent, foreground service, accessibility service if
  enabled, and overlay permissions where appropriate). If the user leaves the
  reminder, the application should immediately prompt again when permitted by the
  operating system. The implementation must not rely on unsupported exploits or
  attempt to bypass Android security restrictions.
- A configurable minimum response length may be enforced. The default strict-mode minimum is 20 Unicode characters after trimming surrounding whitespace.
- Submission must not close the overlay until the entry has been durably stored locally.
- A backend outage must not prevent successful local submission.
- Operating-system controls, security screens, emergency communication, assistive technologies, and system-level termination must never be blocked.
- Any OS-level interruption must preserve unfinished text and must never be represented as a completed check-in.

On Android, the application must use only platform-approved notification, foreground-service, alarm, and full-screen intent mechanisms. It must not bypass Android security restrictions, device-owner policies, lock-screen protections, or user notification controls.

The detailed reminder chapter must define the final state machine, accessibility
behavior, retry policy, sleep recovery, OS-interruption recovery, and
device-coordination behavior.

## 2.4 Product Philosophy

### 2.4.1 Capture Reality, Not Aspirations

FocusLog records what the owner is actually doing, not merely what they planned to do.

### 2.4.2 Minimize Friction

Completing a check-in must require as little effort as reasonably possible while still encouraging meaningful responses.

### 2.4.3 Respect User Attention and Control

Reminders must be reliable and visible without destroying unsaved work, trapping the user, bypassing platform controls, or creating unpredictable interruptions.

### 2.4.4 Offline First

Core reminder, capture, history, and queueing features must continue to work when the backend or internet connection is unavailable.

### 2.4.5 Local Data Ownership

The owner must be able to export, back up, restore, and permanently delete their data.

### 2.4.6 Reliable Synchronization

The owner must not lose entries because of network interruption, device sleep, application crashes, retries, duplicate delivery, or temporary server failure.

### 2.4.7 Long-Term Maintainability

The architecture must support years of daily use and a large historical dataset without requiring a complete rewrite.

### 2.4.8 Privacy by Design

Only data required for product functionality may be collected. Journal content and related metadata must be protected in transit, at rest where required, in backups, in diagnostics, and in operational tooling.

### 2.4.9 Explainable Behavior

The application must make reminder, synchronization, conflict, backup, and failure states understandable to the owner. It must not silently discard data or conceal unresolved errors.

---

# 3. Product Goals

## 3.1 Primary Goals

FocusLog must:

1. Prompt the owner to create regular, meaningful activity check-ins.
2. Support multiple focus modes with different intervals and policies.
3. Operate reliably on Windows desktop.
4. Operate reliably on Android within platform limitations.
5. Continue core operation offline.
6. Synchronize data safely between authorized devices.
7. Recover from network failures, crashes, sleep, hibernation, forced termination, and ordinary application restarts.
8. Provide useful historical reports.
9. Provide an accurate calendar heatmap.
10. Provide fast full-text search across historical entries.
11. Support secure backup and restore.
12. Support documented, versioned export and import.
13. Provide maintainable build, deployment, packaging, and update workflows.
14. Protect data from accidental loss, corruption, duplication, and unauthorized access.
15. Remain suitable for daily, long-term personal use.

## 3.2 Secondary Goals

FocusLog should:

1. Help owners identify patterns in productivity and distraction.
2. Encourage honest self-observation without judgmental language.
3. Provide useful customization without becoming difficult to configure.
4. Minimize battery consumption on Android.
5. Minimize CPU, memory, disk, and network usage on Windows.
6. Make reminder timing and state transitions predictable.
7. Support future expansion through versioned contracts and modular boundaries.
8. Provide accessible, keyboard-driven desktop interaction.
9. Provide clear diagnostics without exposing sensitive journal content.
10. Allow future optional integration with calendars, task managers, and AI-assisted summaries without making those services mandatory for core operation.

## 3.3 User Goals

The owner must be able to:

- Start a focus session quickly.
- Select or customize an appropriate focus mode.
- Receive reminders at predictable intervals.
- Enter a check-in without navigating through multiple screens.
- Complete a check-in from an authorized desktop or Android device.
- Avoid duplicate reminder interruptions when multiple devices are online.
- Review activity by day, week, month, year, or custom date range.
- Search for a past activity, phrase, tag, category, or session.
- Understand consistency and completion patterns.
- Identify missed, skipped, delayed, and completed reminders.
- Export complete historical data in documented formats.
- Restore data after reinstalling or replacing a device.
- Continue working during internet or backend outages.
- Control reminder modes, intensity, timing, and allowable actions.
- Pause, resume, extend, or stop a focus session.
- See whether data is local-only, queued, synchronized, conflicted, or failed.
- Resolve synchronization problems without losing either version of an entry.
- Revoke a lost or retired device.
- Delete personal data with clear consequences and appropriate safeguards.

---

# 4. Non-Goals

FocusLog version 1.0 is not intended to be:

1. A team project-management system.
2. An employee-surveillance system.
3. A workplace attendance or compliance tracker.
4. A screenshot-monitoring application.
5. A keystroke logger.
6. A browser-history collector.
7. A replacement for Jira, Trello, Asana, or similar platforms.
8. A social network.
9. A public blogging platform.
10. A medical, psychiatric, or psychological diagnostic tool.
11. A payroll, invoicing, or billable-hours system.
12. A continuous location-tracking system.
13. A system that records audio or video without explicit user action and consent.
14. A system that uploads unrelated personal files.
15. A system that requires a continuous internet connection for core use.
16. A multi-tenant enterprise administration platform.
17. A mechanism for remotely locking, disabling, or coercively controlling another person’s device.

FocusLog must not collect invasive behavioral information merely to infer what the owner is doing.

Adaptive reminder behavior may use narrowly scoped local signals such as idle duration or recent keyboard and pointer activity. It must never capture raw keystrokes, text typed into other applications, screenshots, window contents, clipboard content, private application data, microphone input, camera input, browsing history, or file contents for this purpose.

Any future feature that materially expands data collection must require a specification update, privacy review, explicit owner consent, and an Architecture Decision Record.

---

# 5. Target Users and Operating Model

## 5.1 Primary User

The primary user is an individual who wants greater awareness of how they spend their time.

Typical users may include:

- Students
- Writers
- Researchers
- Software developers
- Designers
- Remote workers
- Freelancers
- Professionals managing independent work
- People developing stronger productivity habits

## 5.2 User Characteristics

The system must not assume advanced technical knowledge.

The owner may:

- Use only one device.
- Use both Windows and Android.
- Use more than one desktop computer.
- Have intermittent internet access.
- Work in multiple languages.
- Keep several years of historical entries.
- Forget or choose not to respond to a reminder.
- Put a computer to sleep or hibernation for several hours.
- Force-close the Android application.
- Reinstall an application.
- Replace, lose, or revoke a device.
- Change time zones.
- Travel across daylight-saving transitions.
- Change the device clock.
- Restore an old backup.
- Expect data to survive application and schema upgrades.

## 5.3 Ownership and Administration Model

The initial release is a single-owner product, not a collaborative multi-user workspace.

The owner may access maintenance functions such as:

- Device registration and revocation
- Database backup
- Restore
- Export and import
- Diagnostics
- Log collection
- Synchronization repair
- Data deletion

These are owner capabilities, not separate organizational roles.

Operational administrators of a hosted deployment must not receive unrestricted access to private check-in content by default. Any exceptional support access must be explicitly authorized, time-limited where feasible, auditable, and designed according to the security requirements.

## 5.4 Supported Operating Modes

The architecture must support at least one of the following release modes and must clearly document which modes are production-supported:

1. **Synchronized owner mode:** Multiple authorized devices synchronize through a backend.
2. **Local-only mode:** A single device stores data locally without backend synchronization.

If both modes are supported, transitions between them must be explicitly designed. The application must not silently upload local-only data or silently discard synchronized ownership metadata.

---

# 6. Core Usage Scenarios

## 6.1 Start a Focus Session

1. The owner opens FocusLog or uses an approved quick-start action.
2. The owner selects a focus mode.
3. The owner may change the session name, duration, interval, tags, category, or reminder policy.
4. The owner starts the session.
5. FocusLog durably records the session start locally.
6. The reminder engine schedules the next reminder occurrence.
7. The session is queued for synchronization when applicable.
8. The session remains recoverable across ordinary application restarts.

## 6.2 Complete a Reminder Check-In

1. A reminder occurrence becomes due.
2. Device-coordination logic selects the appropriate target device when multiple devices are available.
3. The selected device displays the reminder interface.
4. The owner enters a meaningful activity description.
5. The system validates the response according to the active reminder policy.
6. The owner submits the check-in.
7. The entry and reminder transition are stored locally in one durable transaction before the interface reports success.
8. The reminder is marked completed.
9. Synchronization occurs immediately when possible or is queued durably when offline.
10. The next reminder occurrence is calculated from the configured scheduling policy.

## 6.3 Snooze a Reminder

1. A reminder becomes due.
2. The owner chooses an allowed snooze duration.
3. FocusLog records the snooze action and original due time.
4. The reminder is rescheduled according to the active policy.
5. The system prevents uncontrolled repeated snoozing when a limit is configured.
6. The snooze state synchronizes across devices.

## 6.4 Skip or Emergency-Dismiss a Reminder

1. A reminder becomes due.
2. The owner chooses an allowed skip action or invokes emergency dismissal.
3. FocusLog requires a reason when configured.
4. The application records the action truthfully as skipped or emergency-dismissed, not completed.
5. The application calculates the next reminder according to policy.
6. The action synchronizes across devices.

## 6.5 Miss a Reminder

1. A reminder becomes due.
2. The owner does not respond within the defined window.
3. FocusLog records the reminder as pending or overdue.
4. The application follows the configured retry and escalation policy.
5. The reminder may later become completed late, snoozed, skipped, emergency-dismissed, superseded, or missed.
6. The system must not silently discard the occurrence.
7. Multiple overdue reminders must be consolidated according to an explicit policy rather than producing an uncontrolled sequence of overlays.

## 6.6 Recover After Device Sleep or Hibernation

1. A reminder is scheduled.
2. The computer enters sleep or hibernation before the reminder triggers.
3. One or more scheduled times pass while the computer is unavailable.
4. The computer wakes.
5. FocusLog compares monotonic and wall-clock timing information where available.
6. The application identifies due and missed reminder occurrences.
7. The configured recovery policy is applied.
8. The owner receives an appropriate consolidated prompt without an overlay storm.
9. The recovery decision is recorded for synchronization and reporting.

## 6.7 Work Offline

1. The backend or internet connection becomes unavailable.
2. The owner continues to start sessions, receive reminders, create check-ins, and review locally available history.
3. Changes are stored in the local database.
4. Synchronizable operations are added to a durable, idempotent offline queue.
5. The interface clearly indicates the offline or degraded state without blocking normal local capture.
6. Retry attempts use a bounded backoff strategy.
7. When connectivity returns, synchronization resumes automatically.
8. Local entries remain accessible throughout the outage.
9. Failed operations remain diagnosable and recoverable.

## 6.8 Switch Between Desktop and Android

1. The owner starts a session on one device.
2. Session state synchronizes with the backend when available.
3. The owner changes location or begins using another authorized device.
4. Presence and coordination logic determines the best reminder target.
5. FocusLog attempts to show the reminder on only one selected device.
6. If duplicate presentation occurs because of offline operation or a race condition, completion on either device reconciles all equivalent occurrences safely.
7. The completed check-in synchronizes to every authorized device.
8. No duplicate user-visible check-in is created.

## 6.9 Review Historical Activity

1. The owner opens History, Reports, or Calendar.
2. The owner selects a date range.
3. FocusLog displays entries, completion states, focus modes, response delays, sessions, and applicable metrics.
4. The owner filters by tag, category, device, session, focus mode, status, or date.
5. The owner opens an entry to review its details and permitted actions.
6. All displayed times are clear about local time-zone interpretation.

## 6.10 Search History

1. The owner enters a search query.
2. FocusLog searches check-in text and approved metadata.
3. Results are ranked and displayed within the defined performance target.
4. The owner applies filters.
5. The owner opens, edits, or exports a result when permitted.
6. Search must remain useful offline for locally available data.

## 6.11 Edit or Delete an Entry

1. The owner opens an existing entry.
2. The owner edits the content or requests deletion.
3. FocusLog validates the change.
4. The application stores the new version or deletion tombstone locally.
5. The change is added to the synchronization queue.
6. Concurrent edits are reconciled according to the conflict-resolution policy.
7. The audit metadata preserves creation time and modification history as required by the data specification.

## 6.12 Back Up and Restore

1. The owner requests a backup.
2. FocusLog creates a consistent snapshot.
3. The backup is validated and written atomically.
4. Sensitive backup content is encrypted according to the security specification.
5. The owner reinstalls FocusLog or moves to another device.
6. The owner selects a backup file.
7. FocusLog validates format version, integrity, compatibility, and ownership expectations.
8. The application previews the restore operation and warns about destructive consequences.
9. The owner confirms.
10. Data is restored transactionally without unintended duplication.
11. The application verifies the restored database before normal operation resumes.

## 6.13 Revoke a Device

1. The owner opens device management from an authorized device.
2. The owner identifies a lost, replaced, or retired device.
3. The owner revokes it.
4. The backend rejects future authenticated requests from the revoked credential.
5. Other devices receive the updated device list.
6. Revocation does not silently delete historical entries created by that device.

---

# 7. Product Success Criteria

The first production release is successful only when all mandatory acceptance criteria are met and the following outcomes have been demonstrated:

1. A non-developer can install the Windows application without installing development tools.
2. A supported Windows installer can install, launch, update, repair where supported, and uninstall the application correctly.
3. A user can install the Android application through an approved APK or supported distribution channel.
4. A user can establish an owner identity for synchronized mode or deliberately configure supported local-only mode.
5. A user can register and revoke devices securely.
6. A user can start, pause, resume, extend, and stop focus sessions.
7. Reminder state survives ordinary application restarts.
8. Desktop reminders recover correctly after Windows sleep and hibernation.
9. Android reminders operate as reliably as the supported Android APIs and device policies permit.
10. Check-ins can be created and reviewed offline.
11. Offline operations synchronize after connectivity returns.
12. Retried requests and duplicate event delivery do not create duplicate user-visible entries.
13. Conflicts are resolved or surfaced without silently discarding either user-authored version.
14. Historical data can be searched within the defined performance targets.
15. Reports operate correctly across day, week, month, year, and custom ranges.
16. The calendar heatmap accurately reflects the defined activity metric.
17. Backup files can be created, integrity-checked, and restored.
18. Exported data can be imported into a clean, compatible installation.
19. Logs and diagnostics support troubleshooting without exposing check-in text by default.
20. Automated tests cover critical reminder, persistence, synchronization, authorization, backup, restore, and migration rules.
21. CI validates backend, desktop, Android, contracts, database migrations, security checks, packaging configuration, and documentation.
22. The Docker-based backend deployment starts from documented commands in a clean environment.
23. Production deployment and recovery procedures have been tested.
24. The project can be maintained from repository documentation without relying on undocumented knowledge.
25. No critical or high-severity unresolved defect remains at release approval.

Detailed non-functional requirements will define measurable thresholds for startup time, local write latency, search latency, synchronization convergence, resource usage, reliability, and recovery.

---

# 8. High-Level Product Scope

FocusLog version 1.0 includes the following major subsystems:

1. Backend service
2. PostgreSQL server database
3. Versioned REST API
4. Versioned WebSocket synchronization and presence gateway
5. Windows Electron desktop application
6. Flutter Android application
7. Local desktop persistence
8. Local Android persistence
9. Focus Session Engine
10. Reminder scheduling and recovery engine
11. Device-presence and reminder-coordination service
12. Durable offline operation queue
13. Synchronization and conflict-resolution engine
14. Reports and analytics module
15. Calendar heatmap
16. Full-text search
17. User and device settings
18. Backup and restore
19. Export and import
20. Owner identity and device authorization
21. Device revocation
22. Logging, diagnostics, and health monitoring
23. Automated tests
24. Docker-based backend deployment
25. CI/CD pipelines
26. Windows packaging and update strategy
27. Android packaging and distribution strategy
28. Technical, operational, and user documentation

The detailed specification must define the boundaries, responsibilities, interfaces, and acceptance criteria for every subsystem.

---

# 9. Architecture Governance and Decision Records

## 9.1 Purpose

Architecture Decision Records document important technical decisions made during FocusLog development.

They ensure that future maintainers understand:

- The problem that required a decision
- The selected solution
- The alternatives considered
- The accepted trade-offs
- The positive and negative consequences
- The conditions under which the decision should be revisited

Architecture decisions must not exist only in code, pull requests, chat conversations, or the memory of developers and coding agents.

## 9.2 ADR Repository

The project must maintain the following directory:

```text
docs/
└── adr/
    ├── ADR-001-system-and-monorepo-architecture.md
    ├── ADR-002-server-database-selection.md
    ├── ADR-003-local-persistence-selection.md
    ├── ADR-004-synchronization-architecture.md
    ├── ADR-005-owner-and-device-authorization-model.md
    ├── ADR-006-desktop-framework-selection.md
    ├── ADR-007-mobile-framework-selection.md
    ├── ADR-008-api-contract-and-code-generation.md
    ├── ADR-009-deployment-and-hosting-strategy.md
    └── ADR-010-secrets-encryption-and-backup-strategy.md
```

ADR filenames must be lowercase except for the `ADR` prefix, use zero-padded numbers, and use hyphen-separated descriptive names.

## 9.3 ADR Template

Each ADR must follow this structure:

```markdown
# ADR-NNN: Decision Title

## Status

Proposed | Accepted | Rejected | Deprecated | Superseded

## Date

YYYY-MM-DD

## Decision Owners

Names or roles responsible for the decision.

## Context

What problem, constraint, or requirement requires a decision?

## Decision Drivers

What qualities or constraints matter most?

## Decision

What solution was selected?

## Alternatives Considered

What credible alternatives were evaluated?

## Consequences

### Positive

### Negative

### Risks

## Security and Privacy Impact

## Operational Impact

## Migration or Rollback Plan

## Validation

How will the decision be verified?

## Future Considerations

What conditions should trigger reconsideration?

## Supersedes / Superseded By

References when applicable.
```

## 9.4 Required Initial ADRs

The initial implementation must document at least the following decisions.

### ADR-001: System and Monorepo Architecture

Document:

- Application boundaries
- Shared contract strategy
- Build orchestration
- Dependency direction
- Release boundaries
- Why the selected monorepo approach is preferable to separate repositories

### ADR-002: Server Database Selection

Document why PostgreSQL is selected for synchronized server persistence and compare it with credible alternatives such as managed PostgreSQL variants, MongoDB, Firebase, and other relevant stores.

The decision must consider:

- Transactional integrity
- Relational consistency
- Query and reporting needs
- Full-text search strategy
- Migration support
- Operational maturity
- Backup and point-in-time recovery
- Long-term maintainability

SQLite must not be treated as a direct server-database alternative without acknowledging that it may still be appropriate for local device persistence.

### ADR-003: Local Persistence Selection

Document the local database choices for Electron and Flutter, including:

- SQLite or an approved equivalent
- Transaction support
- Encryption requirements
- Migration strategy
- Search support
- Crash recovery
- Queue durability
- Platform library maturity

### ADR-004: Synchronization Architecture

Document:

- REST responsibilities
- WebSocket responsibilities
- Source-of-truth rules
- Client operation identifiers
- Idempotency
- Versioning
- Offline queue behavior
- Conflict resolution
- Tombstones
- Presence and reminder coordination
- Retry and reconnect policy
- Heartbeats
- Resynchronization after missed events

### ADR-005: Owner and Device Authorization Model

Document how ownership is protected in a personal, single-owner product without assuming that “no collaboration” means “no authentication.”

Consider:

- Owner bootstrap
- Device registration
- Per-device credentials
- Secure secret storage
- Token rotation
- Device revocation
- Recovery
- Local-only mode
- Transport security
- Hosted versus self-hosted deployment

### ADR-006: Desktop Framework Selection

Document the choice of Electron and compare it with credible alternatives such as:

- Tauri
- Native Windows development
- .NET MAUI

The decision must address:

- Reminder overlay capabilities
- Tray integration
- Auto-start
- Windows sleep and resume behavior
- Automatic updates
- Security hardening
- Resource use
- Packaging maturity
- Developer productivity

### ADR-007: Mobile Framework Selection

Document the choice of Flutter and compare it with credible alternatives such as:

- Native Android with Kotlin
- React Native
- .NET MAUI

The decision must address:

- Background and foreground execution
- Notification channels
- Full-screen intents
- Alarm scheduling
- Battery optimization
- Local persistence
- Platform-channel requirements
- Packaging and release maturity

### ADR-008: API Contract and Code Generation

Document how OpenAPI, JSON Schema, event schemas, or an equivalent platform-neutral contract system will be the source of truth.

The strategy must acknowledge that TypeScript source packages cannot be consumed directly by Flutter. TypeScript and Dart models or clients should be generated from platform-neutral contracts where practical.

### ADR-009: Deployment and Hosting Strategy

Document:

- Supported hosting models
- Compute platform
- Database hosting
- TLS termination
- Domain and certificate management
- Backup and recovery
- Monitoring and alerting
- Update strategy
- Rollback strategy
- Cost and maintenance expectations

### ADR-010: Secrets, Encryption, and Backup Strategy

Document:

- Secret generation and storage
- Device credential storage
- Server secret management
- Encryption in transit
- Encryption at rest requirements
- Backup encryption
- Key recovery implications
- Rotation
- Redaction from logs and diagnostics

## 9.5 ADR Process

- New material decisions begin with `Proposed` status.
- Accepted ADRs must be reviewed before dependent production code is merged.
- A changed decision must supersede, not silently overwrite, the original ADR.
- The SRS, architecture documentation, API contracts, and implementation must be updated together.
- CI should validate ADR filename conventions and internal links.

---

# 10. Repository Structure

## 10.1 Repository Model

FocusLog must use a modular monorepo unless ADR-001 approves a demonstrably superior structure.

The repository must separate:

- Deployable applications
- Platform-neutral contracts
- Reusable TypeScript packages
- Infrastructure
- Documentation
- Development tooling
- Generated artifacts

## 10.2 Recommended Structure

```text
FocusLog/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── desktop/
│   │   ├── src/
│   │   ├── electron/
│   │   ├── resources/
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── mobile/
│       ├── android/
│       ├── lib/
│       ├── test/
│       ├── integration_test/
│       └── pubspec.yaml
│
├── contracts/
│   ├── openapi/
│   ├── events/
│   ├── json-schema/
│   └── examples/
│
├── packages/
│   ├── shared-typescript/
│   ├── shared-validation/
│   ├── eslint-config/
│   ├── tsconfig/
│   └── test-utils/
│
├── generated/
│   ├── typescript/
│   └── dart/
│
├── docs/
│   ├── SRS.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── SYNCHRONIZATION.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── OPERATIONS.md
│   ├── TESTING.md
│   ├── TROUBLESHOOTING.md
│   └── adr/
│
├── infra/
│   ├── docker/
│   ├── deployment/
│   ├── monitoring/
│   └── backup/
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│
├── scripts/
├── tools/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
├── .editorconfig
├── .gitattributes
└── .gitignore
```

This structure is provisional until approved by ADR-001 and the technology-stack section.

## 10.3 Repository Requirements

The repository must:

- Use Git version control.
- Support reproducible local development.
- Support CI/CD.
- Allow independent building and testing of backend, desktop, and Android applications.
- Keep platform-specific code isolated.
- Enforce explicit dependency direction.
- Use platform-neutral API and event contracts.
- Generate TypeScript and Dart clients or models from those contracts where practical.
- Avoid duplicating business rules across platforms when a shared specification or generated representation can prevent drift.
- Avoid coupling the mobile application to Node.js-only packages.
- Avoid coupling desktop UI code directly to privileged Electron main-process APIs.
- Keep generated files clearly separated and reproducible.
- Keep secrets, credentials, signing keys, and production configuration out of version control.
- Provide documented commands for build, test, lint, format, migrate, generate, package, and run.

## 10.4 Documentation Requirements

Repository documentation must include:

- Product requirements
- Architecture overview
- Data model and migration strategy
- REST API specification
- WebSocket and synchronization protocol
- Security and privacy model
- Development setup
- Environment configuration
- Build and packaging instructions
- Deployment instructions
- Backup and recovery procedures
- Operations and monitoring procedures
- Testing strategy
- Troubleshooting guides
- Architecture Decision Records
- Release and rollback procedures
- Contribution standards

Documentation must be version-controlled, reviewed with relevant code changes, and validated for broken links where practical.

## 10.5 Source-of-Truth Rules

- This SRS is the source of truth for product and quality requirements.
- ADRs are the source of truth for accepted architectural decisions.
- OpenAPI and approved event schemas are the source of truth for machine-consumable external contracts.
- Database migrations are the source of truth for deployed schema history.
- Generated TypeScript and Dart code must not be edited manually.
- README files must not contradict the SRS, ADRs, contracts, or deployment documentation.

---

# 11. Preliminary Definition of Done

The project is complete only when objective evidence confirms all applicable items below.

## 11.1 Build and Static Validation

- The backend compiles without errors.
- The desktop application compiles without errors.
- The Android application compiles without errors.
- Contract generation succeeds reproducibly.
- Formatting and linting checks pass.
- Static analysis and type checks pass.
- No production-critical path contains unresolved placeholder implementations.
- No mandatory test is disabled merely to make CI pass.

## 11.2 Data and Migrations

- Database migrations succeed on a clean server database.
- Local database migrations succeed on clean desktop and Android installations.
- Upgrade migrations succeed from every supported prior release.
- Migration rollback or recovery behavior is documented where automatic rollback is unsafe.
- Seed data is limited to development and test environments unless explicitly required in production.
- Backup and restore preserve referential integrity and synchronization metadata.

## 11.3 Runtime and Infrastructure

- Docker services start successfully from documented commands.
- Health checks report correct status.
- Required environment variables are documented and validated at startup.
- Production secrets are not embedded in source code, images, installers, logs, or example configuration.
- Deployment, upgrade, rollback, backup, restore, and disaster-recovery procedures have been exercised.

## 11.4 Testing

- Unit tests pass.
- Integration tests pass.
- End-to-end tests pass.
- Contract tests pass.
- Migration tests pass.
- Offline and reconnect tests pass.
- Duplicate-delivery and idempotency tests pass.
- Sleep, resume, restart, and crash-recovery tests pass on supported platforms.
- Backup, restore, export, and import tests pass.
- Device registration and revocation tests pass.
- Accessibility checks meet the defined standard.
- Performance and reliability tests meet the defined thresholds.
- Security checks meet the release policy.

## 11.5 Packaging and Distribution

- A Windows installer can be built reproducibly.
- The Windows installer can install, launch, update, and uninstall the application correctly.
- Windows signing and update procedures are documented.
- An Android APK can be built reproducibly.
- The Android application can be installed and launched on every supported Android version.
- Android signing, versioning, permissions, and distribution procedures are documented.

## 11.6 Functional Completion

- Offline mode functions according to the specification.
- Synchronization converges correctly after disconnection.
- Duplicate events do not create duplicate entries.
- Reminder recovery works after sleep, restart, and temporary process failure.
- Multi-device reminder coordination works under normal operation and degrades safely during partitions.
- Search, reports, heatmap, settings, export, import, backup, and restore satisfy their acceptance criteria.
- Device revocation prevents future authorized synchronization by the revoked credential.

## 11.7 Documentation

- The root README is complete.
- Architecture documentation is complete.
- API and event documentation is complete.
- Database documentation is complete.
- Security and privacy documentation is complete.
- Development setup is complete.
- Production deployment documentation is complete.
- Operations, monitoring, backup, recovery, rollback, and troubleshooting documentation is complete.
- User-facing installation and basic usage documentation is complete.

## 11.8 Release Quality

- CI passes on the release commit.
- Required manual acceptance tests have documented evidence.
- No critical or high-severity unresolved defect remains.
- No known data-loss defect remains.
- No known authorization-bypass defect remains.
- Every mandatory acceptance criterion has been verified.
- Any accepted lower-severity limitation is documented with impact, workaround, owner, and planned resolution.

The implementation agent must not declare completion based only on generated source code. Completion requires successful execution and documented verification in an environment capable of building and testing each platform.

---

# 12. Future Roadmap Candidates

The following items are outside the mandatory version 1.0 scope unless promoted through a formal specification change:

- Calendar integration
- Task-manager integration
- AI-assisted summaries
- AI-assisted categorization
- Optional end-to-end encrypted synchronization
- iOS support
- macOS support
- Linux support
- Browser extension
- Web application
- Wearable-device support
- User-defined automation rules
- Advanced goals and habit experiments
- Plugin or integration SDK

Future features must preserve FocusLog’s core principles: honest capture, low friction, local ownership, privacy, offline resilience, predictable reminders, and reliable synchronization.

---

# 13. Specification Completion Record

The detailed requirements catalogue in section 14 defines, at minimum:

- Owner identity and onboarding
- Device registration and revocation
- Focus modes
- Focus sessions
- Reminder occurrence state machine
- Standard and Strict Reminder Modes
- Check-in creation and validation
- Manual entries
- Snooze, skip, emergency dismissal, and missed reminders
- Sleep, hibernation, clock change, and time-zone handling
- Multi-device reminder coordination
- Entry editing, deletion, and tombstones
- History and filtering
- Search
- Reports and analytics
- Heatmap calendar
- Settings
- Offline behavior
- Synchronization visibility and recovery
- Backup, restore, export, and import
- Diagnostics and privacy controls

Every requirement uses a stable identifier and explicit acceptance criterion.
The generated requirement-to-test matrix is maintained at
`docs/REQUIREMENTS-TRACEABILITY.md`; release validation must fail if an ID is
unmapped or the generated matrix is stale.

---

# 14. Detailed Version 1.0 Requirements

This section is the canonical normative requirement catalogue for version 1.0.
Identifiers are permanent. A retired requirement remains in the catalogue with a
retired status; its identifier is never reassigned.

## 14.1 Ownership and Core Product

**[FR-001] Single-owner model.** A FocusLog installation must represent exactly
one personal owner and must not expose user registration, passwords, tenant
administration, user roles, or administrator roles.

Acceptance: **[ACC-001]** a new installation creates one owner device, and all
persisted domain records and trusted devices resolve to that owner.

**[FR-002] Device pairing.** The owner device must create an expiring pairing code
that a candidate Windows or Android device can claim with proof of possession of
its generated key and that the owner explicitly approves.

Acceptance: **[ACC-002]** an unpaired device cannot use authenticated APIs; after
claim, approval, and consumption, both devices are trusted for the same owner.

**[FR-003] Device revocation.** The owner device must be able to revoke any paired
device, after which its REST requests and WebSocket connections are rejected.

Acceptance: **[ACC-003]** revocation closes a live connection and all later signed
requests from that credential fail authorization.

**[FR-010] Focus modes.** The owner must be able to create, list, update, and
tombstone reusable focus modes with a name, interval, and versioned policy.

Acceptance: **[ACC-010]** mode changes persist locally and remotely and a deleted
mode is excluded from ordinary lists without destroying synchronization history.

**[FR-011] Focus sessions.** The owner must be able to start, inspect, and stop a
focus session using a selected mode, schedule policy, IANA time zone, and precise
UTC instants.

Acceptance: **[ACC-011]** an active session survives restart, has deterministic
reminder occurrences, and records its actual start and end instants.

**[FR-020] Check-in capture and validation.** FocusLog must support manual and
reminder-linked check-ins. A reminder completion must contain at least 20 Unicode
characters after trimming; unfinished text must remain durable until resolution.

Acceptance: **[ACC-020]** empty or shorter reminder responses are rejected on
every platform and the backend, while a valid response creates one check-in.

**[FR-021] Entry revisions and deletion.** User-authored check-ins must retain
immutable revisions. Deletion must create a synchronized tombstone and must not
erase unresolved concurrent user writing.

Acceptance: **[ACC-021]** edits preserve earlier text, deletion converges across
devices, and concurrent text is retained as a visible conflict.

**[FR-022] History and filtering.** History must be available offline, ordered
predictably, and filterable by full text, tag, category, and focus session.

Acceptance: **[ACC-022]** identical filters return equivalent records on desktop,
Android, and backend, with relevance before recency for non-empty text queries.

**[FR-023] Settings.** Personal settings, including startup and reminder policy,
must persist locally and synchronize where the setting applies across devices.

Acceptance: **[ACC-023]** restarting a device retains settings and a local-only
platform setting is not incorrectly imposed on another platform.

## 14.2 Reminders

**[REM-001] Reminder state machine.** Reminder occurrences must follow validated
transitions through `SCHEDULED`, `DUE`, `PRESENTED`, `SNOOZED`, `COMPLETED`,
`MISSED`, and approved exceptional terminal states. Every transition is durable.

Acceptance: **[ACC-030]** valid transitions produce one transition record and
invalid or duplicate terminal transitions cannot create a second completion.

**[REM-002] Reminder policy.** Configurable interval, response window, recurrence,
snooze choices, maximum snoozes, late-completion, missed-reminder, skip, and
emergency-dismiss behavior must be represented by a versioned policy snapshot.

Acceptance: **[ACC-031]** an occurrence continues to use its captured policy when
the reusable mode is subsequently edited.

**[REM-003] Persistent scheduling and recovery.** Scheduling must survive process
restart, device restart, sleep, hibernation, clock changes, and time-zone or DST
changes without losing or duplicating an occurrence.

Acceptance: **[ACC-032]** recovery evaluates persisted UTC instants and policy,
presents still-actionable reminders, and marks expired windows missed exactly once.

**[REM-004] Platform presentation.** On Windows, the accessible, always-on-top
full-screen overlay must remain visible until a valid response is durably stored,
must expose no UI control to dismiss, minimize, maximize, or close it, must preserve
the draft, and should regain focus if focus is lost. On Android, the reminder must
remain the active foreground interface using the strongest supported mechanisms
(full-screen intent, foreground service, accessibility service if independently
enabled for an appropriate user-facing purpose, and overlay permission where
appropriate). It must re-prompt after the owner leaves whenever Android permits,
and must never use an exploit or bypass Android security controls.

Acceptance: **[ACC-033]** neither platform exposes an in-application reminder
dismissal control; a reminder closes only after a locally durable response of at
least 20 trimmed Unicode characters. OS termination or battery restrictions do
not falsely complete it, preserve unfinished text, and recover transparently.

**[REM-005] Multi-device coordination.** Connected trusted devices must claim a
reminder occurrence through the authenticated gateway so one eligible foreground
device presents it; partitions must remain safe and later deduplicate by occurrence.

Acceptance: **[ACC-034]** simultaneous claims have one winner, duplicate offline
completions converge to one completion, and all authored text is preserved.

## 14.3 Synchronization and Events

**[SYNC-001] Local outbox.** Every synchronizable local mutation must atomically
update the local model and append a durable operation with a globally unique
operation ID and monotonic per-device sequence.

Acceptance: **[ACC-040]** work created with no network remains usable and queued
after restart without partial domain or outbox writes.

**[SYNC-002] Push, pull, and cursors.** Trusted devices must synchronize through
bounded push and pull batches and persist the last atomically applied owner-stream
cursor before acknowledging it.

Acceptance: **[ACC-041]** after connectivity returns, changes flow Android to
backend to desktop and in the reverse direction without manual data reconstruction.

**[SYNC-003] Idempotency and retry.** Duplicate operation IDs must return the
original outcome. Network failure, interruption, and server restart must trigger
bounded exponential retry without corrupting local or remote data.

Acceptance: **[ACC-042]** replaying a request cannot duplicate a check-in and an
interrupted push can be retried to convergence.

**[SYNC-004] Conflict preservation.** A mutation based on a stale version must not
silently overwrite user-authored content; both payloads and operation references
must be stored in a resolvable conflict.

Acceptance: **[ACC-043]** simultaneous edits result in a conflict containing both
versions while the last confirmed current revision remains intact.

**[SYNC-005] Tombstones.** Synchronized deletion must use retained, versioned
tombstones so delayed devices do not recreate deleted records.

Acceptance: **[ACC-044]** a device returning after deletion applies the tombstone
and the record remains absent from normal history.

**[WS-001] Authenticated versioned gateway.** `/api/v1/ws` must require a fresh,
nonce-protected Ed25519 device signature over the versioned handshake and all
client and server frames must conform to the published JSON Schema.

Acceptance: **[ACC-050]** invalid, replayed, expired, unknown, and revoked device
handshakes fail; valid version 1 handshakes receive `connection.ready`.

**[WS-002] Presence and heartbeat.** The gateway must track foreground/background
presence and reminder capability, acknowledge heartbeats, publish owner-scoped
snapshots, and expire stale connections.

Acceptance: **[ACC-051]** two owner devices see one another, heartbeats keep them
present, and a disconnected or timed-out device disappears.

**[WS-003] Sync notification and reconnect.** A successful sync push must notify
other connected owner devices of the new cursor. Desktop and Android clients must
reconnect with bounded exponential backoff and trigger REST pull on notification.

Acceptance: **[ACC-052]** a disconnected client reconnects with a new authenticated
handshake and receives the next sync notification without polling delay.

**[WS-004] Reminder claims.** Claim request, grant, denial, release, and expiry
messages must be owner-scoped, idempotent for the winning device, and prioritize an
eligible foreground device deterministically.

Acceptance: **[ACC-053]** concurrent claim requests produce exactly one active
claim and reveal no presence or reminder data to another owner.

## 14.4 APIs, Persistence, Search, and Reports

**[API-001] Versioned REST contract.** All backend business endpoints must be
under `/api/v1`, represented in OpenAPI 3.1, served by the backend, and checked
against implemented Fastify routes during generation and CI.

Acceptance: **[ACC-060]** contract generation is deterministic and fails for a
missing, stale, or unversioned route.

**[API-002] Validation and errors.** Inputs must be bounded and validated before
persistence, and failures must return a structured error code, message, status,
and safe optional details.

Acceptance: **[ACC-061]** malformed identifiers, timestamps, cursors, policies,
searches, and bodies fail without a partial write or secret disclosure.

**[DATA-001] Server persistence.** PostgreSQL migrations must be version controlled;
UTC instants use time-zone-aware columns; synchronized IDs are client-generable;
and expected owner, state, time, cursor, and full-text queries are indexed.

Acceptance: **[ACC-062]** a clean database migrates to the current schema and all
migration contract tests pass.

**[DATA-002] Local persistence.** Desktop and Android must use encrypted SQLite
databases with versioned migrations, foreign keys, WAL where supported, local
outbox/cursors/conflicts/tombstones, and compatible synchronization identifiers.

Acceptance: **[ACC-063]** clean creation and every supported upgrade produce a
usable current schema without plaintext fallback or silent key replacement.

**[DATA-003] Ranked full-text search.** Desktop and Android must use SQLite FTS5;
the backend must use PostgreSQL full-text search with a stored `tsvector` and GIN
index. `%LIKE%` content search is prohibited.

Acceptance: **[ACC-064]** relevance ranking and tag/category/session filters pass
the 10,000-record benchmark within 1.5 seconds locally and 2 seconds on the server
reference test environment.

**[FR-030] Daily and aggregate reports.** Offline reports must include a complete
day timeline, completed and missed intervals, total tracked time, categories, focus
score, and weekly, monthly, yearly, and trend summaries.

Acceptance: **[ACC-065]** report bounds use the selected IANA zone and remain
correct on 23-hour and 25-hour DST days and across long-term history.

**[FR-031] Yearly heatmap and day log.** A GitHub-style calendar must display every
civil day in the selected year, calculate stable activity intensity, and open the
complete log when a day is selected.

Acceptance: **[ACC-066]** leap years contain 366 cells, ordinary years 365, empty
days remain visible, and selecting any day returns all events inside its local bounds.

## 14.5 Security, Platforms, and Operations

**[SEC-001] Device key protection.** Every installation must generate a unique
Ed25519 key pair. Windows protects the private key with OS credential protection;
Android protects credentials through Android Keystore-backed secure storage.

Acceptance: **[ACC-070]** no static or placeholder identity exists, private key
material is never logged or sent, and reinstall/restore behavior is explicit.

**[SEC-002] Transport and request security.** Production traffic must use TLS.
REST and WebSocket authentication must verify signature, timestamp, nonce, active
device status, and owner scope, with rate limiting and safe secret configuration.

Acceptance: **[ACC-071]** replay, cross-owner access, invalid signature, plaintext
production transport, and revoked credentials are rejected.

**[SEC-003] Backup, export, import, and restore.** Backups and exports must be
authenticated-encrypted, checksummed, versioned, written atomically, and fully
validated before any restore mutation.

Acceptance: **[ACC-072]** a valid archive restores identity and data, while a
wrong key, tampering, truncation, unsupported version, or invalid record rejects
the entire restore.

**[SEC-004] Permanent deletion and privacy.** The owner must be able to permanently
delete server and local data with explicit confirmation, close live access, and
remove recoverable local credentials and database material where the OS permits.

Acceptance: **[ACC-073]** deletion is owner-scoped, cannot be triggered by a
paired non-owner device, and leaves no usable application credential.

**[DESK-001] Windows application.** The Electron/React application must provide
onboarding, pairing, dashboard, sessions, overlay, history, search, reports,
heatmap, settings, tray, startup, encrypted local persistence, offline operation,
restart/sleep recovery, and a reproducible installer.

Acceptance: **[ACC-074]** the production installer installs, launches, starts by
configured policy, recovers after restart/sleep, works offline, and uninstalls
without deleting owner data unless explicitly selected.

**[MOB-001] Android application.** The Flutter application must provide pairing,
dashboard, sessions, reminders, history, ranked search, reports, heatmap, settings,
encrypted Drift persistence, offline operation, synchronization, supported
background scheduling, and a reproducible signed release configuration.

Acceptance: **[ACC-075]** the APK installs and launches on a supported Android
device, explains battery restrictions, preserves offline work, and recovers after
termination or reboot within Android platform limits.

**[NFR-001] Local-first availability.** Core capture, sessions, reminders, history,
search, and reports must work without the backend; network state must never block a
local write or misrepresent unsynchronized work as synchronized.

Acceptance: **[ACC-076]** desktop and Android offline acceptance tests complete
their workflows and later synchronize without data loss.

**[NFR-002] Accessibility and performance.** Interactive controls and reminder
presentation must be keyboard/screen-reader accessible, status changes announced,
and indexed queries and background work must remain within defined test budgets.

Acceptance: **[ACC-077]** automated semantics/foundation tests and search benchmark
tests pass with no high-severity accessibility defect open.

**[OPS-001] Production deployment.** The backend and PostgreSQL must run through
versioned Docker configuration with health/readiness checks, migration-on-deploy,
environment validation, monitoring guidance, encrypted backup, and tested restore.

Acceptance: **[ACC-078]** a clean Docker deployment becomes ready after migrations,
survives service restart, and restores a verified backup.

**[OPS-002] CI, packaging, and release.** GitHub Actions must lint, type-check,
test, verify contracts and migrations, build all applications, and produce
reproducible Windows and Android artifacts using protected signing secrets.

Acceptance: **[ACC-079]** the release workflow fails on contract drift or test
failure and succeeds from a clean checkout with the documented toolchain.

**[TEST-001] Requirement traceability.** Every active requirement and acceptance
criterion in this catalogue must map to at least one automated or explicitly
identified manual acceptance test in the generated traceability matrix.

Acceptance: **[ACC-080]** traceability generation fails on an unmapped ID, duplicate
ID, nonexistent test path, or stale generated matrix.
