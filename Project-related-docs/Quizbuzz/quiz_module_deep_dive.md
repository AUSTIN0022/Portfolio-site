# Quiz Module: Internal Engine Architecture

The `src/modules/quiz` directory contains the core real-time engine of QuizBuzz. This module manages live synchronized competition, state synchronization, and proctoring.

## Real-time Interaction Model

The module uses two distinct gateways to separate participant interaction from administrative control, all orchestrated by a shared set of services.

```mermaid
graph TD
    %% Gateways
    subgraph "WebSocket Interface"
        QG["QuizGateway (Participants)"]
        AG["AdminGateway (Admins)"]
    end

    %% State & Logic
    subgraph "Core Engine"
        QS["QuizService (Orchestrator)"]
        QSession["QuizSession (State Manager)"]
        QAuth["QuizAuthService (Security)"]
        QSch["QuizScheduler (Timers)"]
    end

    %% Monitoring
    subgraph "Safety Layer"
        Proc["ProctoringService"]
        Val["QuizValidator"]
    end

    %% Flow
    QG -->|Events: join, submit, ping| QS
    AG -->|Events: start_quiz, next_question, broadcast| QS
    
    QS <-->|Read/Write State| QSession
    QS -->|Schedules| QSch
    QS -->|Validates| Val
    
    QG -.->|Auth Check| QAuth
    AG -.->|Auth Check| QAuth
    
    QS -->|Record Violation| Proc
    Proc -->|Notify| AG
```

## Quiz Session State Flow (Question Lifecycle)

The following diagram illustrates how the `QuizSession` state evolves during a live contest.

```mermaid
stateDiagram-v2
    [*] --> PRE_JOINING: Contest Created
    PRE_JOINING --> JOINING: Admin Starts Session
    JOINING --> READY: All Participants Ready / Timer End
    
    state QUESTION_CYCLE {
        READY --> STARTING_QUESTION: Admin/Timer Trigger
        STARTING_QUESTION --> QUESTION_ACTIVE: question_start Emitted
        QUESTION_ACTIVE --> QUESTION_ENDING: Timer Countdown
        QUESTION_ENDING --> SHOWING_LEADERBOARD: question_end Emitted
        SHOWING_LEADERBOARD --> STARTING_QUESTION: Next Question
    }
    
    SHOWING_LEADERBOARD --> COMPLETED: Last Question Finished
    COMPLETED --> [*]
```

## Component Roles & Responsibilities

| File | Primary Role | Key Responsibility |
| :--- | :--- | :--- |
| `quiz.session.ts` | **State Container** | Manages in-memory maps for participants, scores, and current question index. Syncs to Redis for horizontal scale. |
| `quiz.service.ts` | **Business Logic** | Processes submissions, calculates scores, and manages the "truth" of the session state. |
| `quiz.gateway.ts` | **Participant I/O** | Handles participant-side Socket.IO events (`answer_submitted`, `participant_ready`). |
| `admin.gateway.ts` | **Administrative I/O** | Handles admin-side control signals (`start_quiz`, `skip_question`, `ban_participant`). |
| `quiz-scheduler.service.ts` | **Orchestration** | Manages the precision timing required for synchronized question delivery. |
| `proctoring.service.ts` | **Monitoring** | Listens for telemetry from clients (tab switches, visibility changes) and logs violations. |
| `quiz-auth.service.ts` | **Gatekeeper** | Validates JWTs and verifies that participants are actually registered for the contest they are trying to join. |

## Internal Event Bus (Conceptual)

While it uses Socket.IO for external communication, internally the module behaves like a state machine:

1.  **Incoming Trigger**: (e.g., `AG.next_question`)
2.  **State Update**: `QS` updates `QSession`.
3.  **Side Effects**: `QSch` calculates the next timer window.
4.  **Outgoing Emission**: `QG` and `AG` broadcast the updated state to their respective namespaces.
