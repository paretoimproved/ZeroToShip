# Session Context

Session ID: 3dd1e456-ad05-43b0-8de8-34a91f97d386
Commit Message: Yes

## Prompts

### Prompt 1

Yes

## Summary

Take a look at **http://localhost:57825** — showing the architecture overview for Unbuilt.dev: what stays, what changes, and what gets dropped from the current pipeline.

**Section 1: Architecture**

The core insight is how little changes. The pipeline engine (scrape → deduplicate → embed → score → gap analyze → generate → deliver) stays intact. What changes:

- **Scraper queries:** Instead of "startup opportunities" and "market gaps," you search for "feature requests," "I wish X existed," "why isn't there a tool for Y," "workaround for Z"
- **Gap analyzer prompts:** Instead of "identify business opportunities," it's "identify developer tools that are requested but don't exist, with evidence"
- **Output format:** Instead of full product specs (bridge-id style), generate concise gap reports: what's missing, evidence links, signal strength, trend direction
- **Delivery:** Substack instead of Resend. Initially manual paste from pipeline output, potentially Substack API later

Everything else — the orchestrator, the phase contracts, the resume support, the embedding engine, the scoring cache — works as-is.

Does this architecture feel right so far?
