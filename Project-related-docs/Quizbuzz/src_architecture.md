# QuizBuzz /src/ Directory Architecture

This document provides a granular visualization of the internal logic and data flow within the `src` directory.

## Request Lifecycle Flow

The following diagram maps how an HTTP request travels through the system from the entry point to the database and back.

```mermaid
sequenceDiagram
    participant User as User Client
    participant App as app.ts (Express)
    participant MW as Middlewares (Auth/Err)
    participant Route as routes.ts (Router)
    participant Ctrl as Controller
    participant Svc as Service
    participant Repo as Repository
    participant DB as Prisma/Postgres

    User->>App: HTTP Request (REST)
    App->>MW: Security/Logging/Parser
    MW->>Route: Match Pattern (/api/v1/...)
    Route->>Ctrl: Invoke Handler
    Ctrl->>Svc: Business Logic Execution
    Svc->>Repo: Data Access Request
    Repo->>DB: Execute SQL Query
    DB-->>Repo: Query Results
    Repo-->>Svc: Data Model
    Svc-->>Ctrl: Processed Result
    Ctrl-->>User: JSON Response (200 OK)
    
    Note over MW,Ctrl: Global Error Handler catches any exceptions
```

## Domain Module Pattern (Standardized)

Each module in `src/modules/` follows a consistent architectural pattern to ensure maintainability and separation of concerns.

```mermaid
graph TD
    subgraph "Standard Module Folder"
        Router["*.routes.ts"]
        Controller["*.controller.ts"]
        Service["*.service.ts"]
        Repo["*.repository.ts"]
        Types["*.types.ts"]
    end

    Router -->|Calls| Controller
    Controller -->|Orchestrates| Service
    Service -->|Abstracts Data| Repo
    Repo -->|Uses| PrismaClient[(Prisma)]
    
    Service -.->|Validates| Schema["Zod Schema (Common)"]
    Service -.->|Depends on| OtherSvc["Other Services"]
```

## WebSocket Logic & Quiz Engine

The `src/modules/quiz` module is the most complex, integrating with the core `socket` infrastructure for real-time interactivity.

```mermaid
graph TD
    subgraph "Real-time Gateway"
        QG["QuizGateway"]
        AG["AdminGateway"]
        SS["SocketService"]
    end

    subgraph "Core Engine"
        QS["QuizService"]
        QSession["QuizSession (In-memory/Redis)"]
        PS["ProctoringService"]
    end

    subgraph "Background Tasks"
        TW["TimerWorker"]
        BullMQ["Redis Queue"]
    end

    QG -->|Events| QS
    AG -->|Events| QS
    QS -->|Maintains| QSession
    QS -->|Monitors| PS
    
    TW -->|Triggers| QG
    TW -->|Updates| QS
    QS -->|Schedules| TW
```

## `src` Directory Map

| Directory | Purpose | Key Files |
| :--- | :--- | :--- |
| `common/` | Shared constants, schemas, and base classes | `constants.ts`, `schemas/` |
| `config/` | Application configuration and connection setups | `db.ts`, `redis.ts`, `logger.ts` |
| `middlewares/` | Express middlewares for auth, errors, and validation | `auth.middleware.ts`, `error.middleware.ts` |
| `modules/` | Domain-driven business logic modules | `contest/`, `quiz/`, `admin/` |
| `providers/` | External service wrappers | `razorpay.provider.ts` |
| `socket/` | WebSocket core setup and shared adapters | `socket.ts`, `redis-adapter.ts` |
| `workers/` | Background job processing logic | `quiz-timer.worker.ts` |

## Data Flow: Real-time Quiz Example

1.  **Participant Joins**: Participant hits `QuizGateway` via Socket.IO.
2.  **Authentication**: `QuizAuthService` validates the token via `MessagingService`.
3.  **State Initialization**: `QuizService` fetches contest data and initializes `QuizSession`.
4.  **Timer Start**: `QuizSchedulerService` queues a job in `TimerWorker`.
5.  **Broadcast**: `TimerWorker` triggers the `QuizGateway` to emit "question_start" to all participants.
6.  **Submission**: Participants submit answers; `SubmissionService` stores them in PostgreSQL while `QuizSession` tracks progress.
