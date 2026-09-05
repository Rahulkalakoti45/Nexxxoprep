# NexoPrep Architecture

## High Level Architecture

                React Frontend
                       │
                       │
        ┌──────────────┴──────────────┐
        │                             │
 Interview Engine             Behavior Engine
        │                             │
 ElevenLabs                 Python + MediaPipe
        │                             │
 Custom LLM                  OpenCV Processing
        │                             │
 Gemini                  Behavior Reports
        │                             │
 Conversation Memory
        │
 PostgreSQL + Redis

-----------------------------------------

## Interview Engine

Responsible for:

- Resume Upload
- Resume Parsing
- Session Creation
- Company Selection
- Role Selection
- Difficulty Selection
- Adaptive Interview
- Voice Conversation
- Transcript
- Interview Report

Technology

React
Node.js
Fastify
Gemini
ElevenLabs
Redis
PostgreSQL

-----------------------------------------

## Behavior Engine

Responsible for

- Eye Contact
- Head Pose
- Posture
- Hand Gestures
- Facial Expression
- Attention
- Engagement
- Timeline
- Graphs
- Behavior Report

Technology

Python

MediaPipe

OpenCV

NumPy

Matplotlib

-----------------------------------------

## Design Rules

Interview Engine MUST NEVER depend on Behavior Engine.

Behavior Engine MUST NEVER modify:

- Gemini
- Prompt
- Transcript
- Conversation
- Interview Flow

Behavior Engine only observes.

-----------------------------------------

## Deployment Goal

React

↓

Node Backend

↓

Python Behavior Service

↓

PostgreSQL

↓

Redis

↓

Cloud Storage (Future)

-----------------------------------------

## Current Status

Interview Engine

Stable

Behavior Engine

Standalone

Next Goal

Integration