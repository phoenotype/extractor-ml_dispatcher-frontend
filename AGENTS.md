# Working agreement

- After implementation changes, run the relevant tests, lint, and production build.
- When all required checks pass, commit the validated changes and push the current branch before deploying.
- Deploy the validated pushed revision to the existing Cloud Run service.
- Do not push or deploy a revision when required checks fail; report and fix the failures first.
