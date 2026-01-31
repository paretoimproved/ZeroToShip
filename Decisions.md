# Architecture Decision Records

> **What are ADRs?** Short documents that capture important architectural decisions along with their context and consequences. They help teams understand why decisions were made.

---

## ADR-001: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded
**Deciders**: [List of people involved]
**Tags**: #architecture #database #api (example tags)

### Context
What is the issue we're trying to solve? What factors are driving this decision?

- Background information
- Current situation
- Problems we're facing
- Constraints we're working within

### Decision
What are we going to do? State the decision clearly and concisely.

**We will [decision statement].**

### Options Considered

#### Option 1: [Name]
**Pros**:
- Pro 1
- Pro 2

**Cons**:
- Con 1
- Con 2

**Effort**: Low | Medium | High

#### Option 2: [Name]
**Pros**:
- Pro 1
- Pro 2

**Cons**:
- Con 1
- Con 2

**Effort**: Low | Medium | High

### Rationale
Why did we choose this option over the others?

- Reason 1
- Reason 2

### Consequences

**Positive**:
- Benefit 1

**Negative**:
- Trade-off 1

**Neutral**:
- Change 1

### Implementation Notes
How will this decision be implemented?

- Step 1
- Files/components affected:

### Follow-up
- [ ] Task 1 to complete this decision

### Related
- Links to related ADRs: [[ADR-XXX]]
- Links to implementation PRs:

---

## Template for New ADRs

Copy the template above when creating new ADRs. Number them sequentially (ADR-001, ADR-002, etc.).

**When to create an ADR**:
- Choosing between architectural patterns
- Selecting technologies or libraries
- Defining system boundaries
- Making trade-offs with significant impact
- Establishing coding standards or conventions

**When NOT to create an ADR**:
- Routine implementation details
- Minor refactoring decisions
- Temporary workarounds
- Decisions that are easily reversible
