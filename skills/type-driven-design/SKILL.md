---
name: type-driven-design
description: Apply strict static typing and type-driven development—make illegal states unrepresentable, parse at boundaries, enforce exhaustive handling, and back architectural rules with compiler and linter checks. Use when designing data models, APIs, state machines, or refactoring loosely typed code.
---

# Type-Driven Design

Use the type system as an executable specification that catches whole classes of bugs before code ever runs.

## 1. Make Illegal States Unrepresentable
- Replace loose bags of optional booleans (`isLoading`, `isError`, `data?`, `error?`) with **discriminated unions** (`{ status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: Error }`).
- Use literal unions, branded/opaque types, or wrapper types for domain primitives that must not be mixed (e.g., `UserId` vs `ProjectId`, absolute vs relative paths, raw vs sanitized strings).
- Use exhaustive `switch` checks (e.g., `never` exhaustiveness helper) so adding a new variant forces every consumer to handle it at compile time.

## 2. Parse, Don't Validate
- Treat external input (HTTP payloads, CLI args, JSON files, env vars, tool stdin) as `unknown`.
- Parse once at the system boundary into strict domain types; keep internal functions free of repetitive defensive null/type checks.
- Static types do not validate JSON, authorize actions, enforce database constraints, or prevent concurrent state changes. Keep runtime checks at the layers responsible for those guarantees.
- Avoid `any`, unchecked `as SomeType` assertions, and non-null `!` escapes. When narrowing is required, write a small, tested type guard or parser.

## 3. Compiler-Driven Refactoring
- Change the type signature or domain model **first**, then follow every compiler error systematically until the codebase typechecks cleanly.
- Keep the project's strict compiler settings enabled (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` in TypeScript). Use each language's own compiler and analysis tools rather than assuming equivalent flags exist everywhere.

## 4. Tool-Enforced Architecture
- Don't rely on prose docs alone to protect module boundaries. Prefer enforcing direction of dependencies, public module entry points, and forbidden imports via linter rules, package exports, or separate workspace packages.
