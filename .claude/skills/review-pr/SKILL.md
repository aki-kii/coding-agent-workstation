---
name: review-pr
description: Review this branch with reviewer subagents in a loop, then open the pull request. Use before creating any pull request; `gh pr create` is blocked until this review passes.
---

# Review, then open the pull request

`.claude/review/review.mjs` decides everything about the loop: which reviewers run, what they see, what comes next, and when the loop ends. You run the reviewers, fix or dispute what they find, and do what the script says. Do not skip a step, and do not decide on your own that the review is good enough.

Make sure the Stop hook's verification passes first; reviewers should not spend a round on lint errors.

## The loop

Run this from the repository root, and do what its `step` says:

```sh
node .claude/review/review.mjs step
```

Repeat until `step` is `open-pr` or `report-abort`. A Stop hook keeps your turn going while a step you can do right now is due, so you cannot drop out of the loop by accident.

| `step`          | What to do                                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`         | Run the `do` command. Pass `--base <ref>` if the branch does not start from `origin/main`.                                                                            |
| `run-reviewers` | For each entry in `reviewers`, launch the subagent named in `agent` with `prompt` unchanged, all in one message. Skip any that are still running. Then wait for them. |
| `judge`         | Run the `do` command.                                                                                                                                                 |
| `respond`       | Fix or dispute every finding in `openFindings` (below), write the responses file named in `do`, then run `next`.                                                      |
| `next`          | Run the `do` command.                                                                                                                                                 |
| `push`          | Commit everything the review saw and push to a branch of the same name (`git push -u origin HEAD`).                                                                   |
| `open-pr`       | Put the output of `review.mjs summary` in the pull request body, then run `gh pr create` as a command of its own.                                                     |
| `report-abort`  | Stop. Report `abort.kind`, `abort.message` and each finding in `abort.findings` with its responses and replies (`review.mjs status`). Wait for the user's decision.   |

Reviewers return their review as their final message; a hook validates and saves it. If `judge` still reports a reviewer's output as missing or invalid, launch that reviewer again with the same prompt.

### Adding a reviewer

When `step` is `run-reviewers`, look at the change yourself before launching. If it needs a reviewer the rules did not pick (for example an IAM change in a file only `cdk` matched), add it; the reason is recorded:

```sh
node .claude/review/review.mjs add security --reason "grants a new role access to the bucket"
```

### Fixing or disputing

Dispute only when you can show why the finding is wrong for this repository; a finding that is inconvenient is not wrong.

Before disputing, investigate. Read the code the finding points at and what calls it, the library source under `node_modules/` (for example `aws-cdk-lib`), the AWS or tool documentation, and run read-only commands (`pnpm exec vp test run`, a synth, `git log`) that settle the question. Every dispute needs at least one `evidence` item the reviewer can check on their own: a `source` (`file:line`, URL, or the exact command) and a `detail` saying what it shows. The reviewer verifies each item and ignores anything that is only an assertion. If the investigation shows the reviewer is right, fix it instead.

Write one response per open finding:

```json
[
  { "id": "cdk-R1-1", "action": "fix" },
  {
    "id": "security-R1-2",
    "action": "dispute",
    "reasonType": "by-design",
    "reason": "The wildcard is scoped by the aws:ResourceTag condition two lines below.",
    "evidence": [
      {
        "source": "src/workstation.ts:88",
        "detail": "The statement adds a StringEquals condition on aws:ResourceTag/workstation."
      }
    ]
  }
]
```

`reasonType` is one of `false-positive`, `out-of-scope`, `by-design`, `accepted-risk`.

## Rules

- Review state lives in `.claude/review/.state/<branch>/`, which git ignores. Never edit it by hand.
- If `start` refuses because a review is `aborted`, ask the user; pass `--restart` only if they tell you to.
- If you change any file after the review passed, `step` goes back to `start` and the gate blocks `gh pr create` again.
