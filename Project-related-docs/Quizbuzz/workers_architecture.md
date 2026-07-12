# QuizBuzz Worker System Architecture

The `src/workers` directory manages all asynchronous and long-running background tasks. The system uses a **Producer-Consumer** pattern facilitated by a centralized registry.

## Asynchronous Task Flow

This diagram illustrates how business modules offload heavy tasks to the background workers.

```mermaid
graph TD
    %% Producers
    subgraph "Domain Modules (Producers)"
        MessagingMod["Messaging Module"]
        SubmissionMod["Submission Module"]
        ContestMod["Contest Module"]
        CertMod["Certificate Module"]
        QuizMod["Quiz Module"]
    end

    %% Queue Layer
    subgraph "Messaging & Queue Infrastructure"
        RedisQueue[(Redis / BullMQ)]
    end

    %% Consumers
    subgraph "Background Workers (Consumers)"
        MW["Message Worker"]
        SW["Submission Worker"]
        EW["Evaluation Worker"]
        CW["Certificate Worker"]
        TW["Quiz Timer Worker"]
        AW["Analytics Worker"]
    end

    %% Interactions
    MessagingMod -->|Add Job| RedisQueue
    SubmissionMod -->|Add Job| RedisQueue
    ContestMod -->|Add Job| RedisQueue
    CertMod -->|Add Job| RedisQueue
    QuizMod -->|Add Job| RedisQueue

    RedisQueue -->|Process| MW
    RedisQueue -->|Process| SW
    RedisQueue -->|Process| EW
    RedisQueue -->|Process| CW
    RedisQueue -->|Process| TW
    RedisQueue -->|Process| AW
    
    %% Dependency Injection
    subgraph "Data Access"
        Prisma[(Prisma / PostgreSQL)]
    end
    
    CW --> Prisma
    SW --> Prisma
    EW --> Prisma
    AW --> Prisma
```

## Worker Initialization Lifecycle

The system uses a registration pattern to decouple worker implementation from server bootstrap.

```mermaid
sequenceDiagram
    participant Server as server.ts
    participant Index as workers/index.ts
    participant Registry as worker.registry.ts
    participant Workers as individual.worker.ts

    Server->>Index: Invoke startWorkers()
    loop For each Worker file
        Index->>Workers: Import file (Trigger Registration)
        Workers->>Registry: register(this)
    end
    Index->>Registry: startAll()
    loop For each registered Worker
        Registry->>Workers: start() (Begin polling queue)
    end
```

## Worker Catalog & Responsibilities

| Worker | Triggering Event | Core Responsibility |
| :--- | :--- | :--- |
| **Message Worker** | SMS/Email requested | Integrates with external providers to deliver notifications. |
| **Submission Worker** | Answer submitted | Persists and validates individual question responses. |
| **Evaluation Worker** | Quiz finished | Calculates final scores, ranks, and updates leaderboards. |
| **Certificate Worker** | Contest completed | Generates PDF certificates with dynamic participant data. |
| **Quiz Timer Worker** | Question started | Manages precise countdowns and triggers state transitions. |
| **Analytics Worker** | Real-time events | Aggregates data for live dashboards and performance reports. |

## Key Implementation Patterns

*   **Self-Registration**: Workers register themselves with the `workerRegistry` upon module import, simplifying the main entry point.
*   **Dependency Injection**: Workers often require services and repositories. These are either imported from `container.ts` or injected via initialization functions (e.g., `injectTimerWorkerDeps`).
*   **Error Handling**: The `WorkerRegistry` handles individual start failures gracefully, ensuring one bad worker doesn't crash the entire background subsystem.
*   **Progress Tracking**: Several workers (Submission, Evaluation) implement granular progress reporting (10%, 40%, etc.) for administrative visibility.
