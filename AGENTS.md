# AGENTS.md

# FamilyLibraryRFID - AI Agent Instructions

This repository is intended to be developed with AI coding assistants such as Codex, ChatGPT, and Claude.

This document is the entry point for AI agents. Before making any code changes, follow the workflow below.

---

# Documentation

All AI-related documentation is located under:

.codex/

Read the documents in the following order.

---

## 1. AI_PROJECT_GUIDE.md (Required)

Purpose:

Understand the overall project.

Includes:

- project overview
- architecture
- technology stack
- business concepts
- design philosophy
- database principles
- API principles
- RFID principles
- permission model

This document should always be read first.

---

## 2. AI_DEVELOPMENT_HISTORY.md (Required)

Purpose:

Understand historical design decisions.

Do not revert previous architectural decisions without explicit instruction.

This document explains why the project is designed this way.

---

## 3. project.md

Purpose:

Understand the current project structure.

Includes:

- repository layout
- sub-projects
- high-level architecture
- Source of Truth

---

## 4. coding_style.md

Purpose:

Follow the project's coding conventions.

Includes:

- naming conventions
- API naming
- database naming
- comment style
- compatibility requirements

All generated code must comply with this document.

---

## 5. task_list.md

Purpose:

Understand the current development task.

Only implement the requested scope.

Do not modify unrelated modules unless explicitly instructed.

---

# Working Workflow

Before writing code, AI should follow this workflow:

1. Read the required documentation.
2. Understand the current task.
3. Review the existing implementation.
4. Identify affected modules.
5. Propose a concise implementation plan.
6. Implement with minimal necessary changes.
7. Ensure consistency with existing architecture.
8. Update related documentation if required.

---

# General Principles

- Docs are the Source of Truth.
- Prefer consistency over new abstractions.
- Prefer minimal changes over large refactoring.
- Preserve backward compatibility whenever possible.
- Never modify architecture without clear requirements.
- Do not invent new naming conventions.
- Follow existing project patterns.

When code conflicts with documentation:

Do not silently modify the code.

Instead, report the inconsistency and wait for confirmation.

---

# Scope Control

Unless explicitly requested:

Do NOT:

- rename database fields
- rename Cloud Functions
- modify existing API contracts
- refactor unrelated modules
- change project architecture
- modify third-party SDK code

Focus only on the requested task.

---

# Output Expectations

When implementing features:

- Explain the implementation approach before making major changes.
- Keep code readable and maintainable.
- Keep modifications as small as possible.
- Reuse existing code whenever practical.
- Use Chinese for code comments.
- Keep documentation synchronized with code changes.
