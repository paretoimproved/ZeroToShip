# Session Context

Session ID: e6ad986b-c8f7-49a6-85da-348dc9ef88fc
Commit Message: Yes, update the CI workflow

## Prompts

### Prompt 1

yes, update the CI workflow

## Summary

Done. The CI workflow now triggers on both PRs and pushes to main.

Next step on your end: enable branch protection in GitHub (Settings → Branches → Add rule for `main`) and require the `build-and-test` status check to pass before merging. That closes the loop so nothing untested reaches Vercel/Railway.
