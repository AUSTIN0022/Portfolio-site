# QuizBuzz Backend Architecture

This document provides a visual and structural overview of the QuizBuzz backend, generated via `/graphify`.

## High-Level Component Diagram

The following C4-style diagram illustrates the primary components of the system and their interactions.

```mermaid
graph TD
    subgraph Clients
        AdminApp["Admin Dashboard (Web)"]
        ParticipantApp["Participant App (Mobile/Web)"]
    end

    subgraph "API Gateway & Communication"
        Express["Express.js REST API"]
        SocketIO["Socket.IO WebSocket Server"]
        AuthMiddleware["Auth & Security Middleware"]
    end

    subgraph "Core Business Logic (Modules)"
        AdminMod["Admin Auth & Org Management"]
        ContestMod["Contest & Question Management"]
        QuizMod["Real-time Quiz Engine"]
        SubMod["Submissions & Evaluation"]
        AnalyticsMod["Analytics & Reporting"]
        ProcMod["Proctoring & Monitoring"]
        CertMod["Certificate Generation"]
        PayMod["Payment Processing"]
    end

    subgraph "Infrastructure & Data"
        Prisma["Prisma ORM"]
        Postgres[(PostgreSQL Database)]
        Redis[(Redis - Pub/Sub & Caching)]
        Workers["Background Workers (BullMQ/Internal)"]
        Razorpay["Razorpay API (External)"]
    end

    %% Interactions
    AdminApp -->|HTTPS/REST| Express
    AdminApp -->|WebSockets| SocketIO
    ParticipantApp -->|HTTPS/REST| Express
    ParticipantApp -->|WebSockets| SocketIO

    Express --> AuthMiddleware
    SocketIO --> AuthMiddleware

    AuthMiddleware --> AdminMod
    AuthMiddleware --> ContestMod
    AuthMiddleware --> QuizMod

    QuizMod -->|State Sync| Redis
    QuizMod -->|Events| SocketIO

    AdminMod --> Prisma
    ContestMod --> Prisma
    SubMod --> Prisma
    AnalyticsMod --> Prisma

    Prisma --> Postgres

    PayMod --> Razorpay
    CertMod --> Workers
    SubMod --> Workers
    Workers --> Postgres
```

## Module Dependency Graph

The system is organized into decoupled modules, wired together via a central dependency container (`container.ts`).

```mermaid
graph LR
    subgraph "Admin & Foundation"
        AdminAuth[Admin Auth]
        Org[Organization]
        Contact[Contact]
    end

    subgraph "Contest Lifecycle"
        Contest[Contest]
        Question[Question]
        Participant[Participant]
        Submission[Submission]
    end

    subgraph "Real-time Execution"
        Quiz[Quiz Engine]
        Proctoring[Proctoring]
        Socket[Socket Service]
    end

    subgraph "Post-Contest"
        Analytics[Analytics]
        Certificate[Certificate]
    end

    %% Dependencies
    AdminAuth --> Org
    Org --> Messaging
    Contest --> Participant
    Contest --> Submission
    Question --> Contest
    Participant --> Contest
    Submission --> Participant
    
    Quiz --> Proctoring
    Quiz --> Messaging
    Analytics --> Quiz
    Certificate --> Participant
```

## Infrastructure Map

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime** | Node.js (TypeScript) | Primary execution environment |
| **Web Framework** | Express.js | REST API routing and middleware |
| **Real-time** | Socket.IO | Bi-directional communication for live quizzes |
| **Database** | PostgreSQL | Persistent relational data storage |
| **ORM** | Prisma | Type-safe database access and migrations |
| **Cache/Queue** | Redis | Quiz state management and worker queues |
| **DI Container** | Manual (Inversion of Control) | Centralized dependency management in `container.ts` |
| **Logging** | Winston/Logger | Structured application logging |

## Key Directories

- `src/modules/`: Contains domain-specific logic (Controller, Service, Repository, Gateway).
- `src/container.ts`: The "brain" that instantiates and links all components.
- `src/socket/`: Core WebSocket infrastructure and adapters.
- `src/workers/`: Background task processing logic.
- `prisma/`: Database schema and migration definitions.
