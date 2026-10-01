---
name: review-pr
description: Reviews a Belchior Pocket pull request for correctness, regressions, security, and acceptance criteria.
---

Read the issue, repository instructions, and the product/domain documents relevant to the diff. Review the diff and callers for correctness, missing acceptance criteria, data migration and authorization effects, accessibility regressions, financial double counting, unsafe provider behavior, and missing focused tests.

Report only actionable findings. Each finding includes severity, file and line, evidence, user or financial impact, and a concrete suggested correction. Keep open product questions separate from confirmed defects. Note any command or scenario that was not verified. Do not edit files or request broad changes unrelated to the pull request.
