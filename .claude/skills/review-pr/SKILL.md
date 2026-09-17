---
name: review-pr
description: Review this branch with reviewer subagents in a loop, then open the pull request. Use before creating any pull request; `gh pr create` is blocked until this review passes.
---

# Review, then open the pull request

`.claude/review/review.mjs` decides everything about the loop: which reviewers run, what they see, and when the loop ends. You run the reviewers, fix or dispute what they find, and do exactly what the script's `result` says. Do not skip a step, and do not decide on your own that the review is good enough.

Run every command from the repository root as `node .claude/review/review.mjs <command>`.

## 1. Start

Make sure the Stop hook's verification passes first; reviewers should not spend a round on lint errors.

```sh
node .claude/review/review.mjs start
```

Pass `--base <ref>` if the branch does not start from `origin/main`. If this branch already has a review that is not done, `start` refuses. When it is `reviewing` or `fixing` (an earlier session stopped midway), continue it from step 2 or 4 according to `node .claude/review/review.mjs status`. When it is `aborted`, ask the user; pass `--restart` only if they tell you to.

Review state lives in `.claude/review/.state/<branch>/`, which git ignores. Never edit it by hand.

`result: "DONE"` here means there is nothing to review. Go to step 5.

## 2. Run the reviewers

`result: "REVIEW"` lists reviewers. For each one, launch the subagent named in `agent` with `prompt` as its prompt, unchanged. Launch them all in parallel, in one message.

Before launching, look at the change yourself. If it needs a reviewer the rules did not pick (for example an IAM change in a file only `cdk` matched), add it:

```sh
node .claude/review/review.mjs add security --reason "grants a new role access to the bucket"
```

`add` prints the plan for that reviewer; launch it with the others.

## 3. Judge

When every reviewer has finished:

```sh
node .claude/review/review.mjs judge
```

If it rejects a reviewer's output, launch that reviewer again with the same prompt plus the error, then run `judge` again.

- `DONE` — go to step 5.
- `FIX` — go to step 4.
- `ABORT` — go to step 6.

## 4. Fix or dispute

For every finding in `openFindings`, either fix it or dispute it. Dispute only when you can show why the finding is wrong for this repository; a finding that is inconvenient is not wrong.

Before disputing, investigate. Read the code the finding points at and what calls it, the library source under `node_modules/` (for example `aws-cdk-lib`), the AWS or tool documentation, and run read-only commands (`pnpm exec vp test run`, a synth, `git log`) that settle the question. Every dispute needs at least one `evidence` item the reviewer can check on their own: a `source` (`file:line`, URL, or the exact command) and a `detail` saying what it shows. The reviewer is told to verify each item and to ignore anything that is only an assertion, so an argument without evidence will be maintained.

If the investigation shows the reviewer is right, fix it instead.

Write one response per open finding to `.claude/review/.state/<branch>/round-<n>/responses.json` (the exact path is in the error if you run `next` without it):

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
      },
      {
        "source": "https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonbedrockagentcore.html",
        "detail": "The actions in the statement support the aws:ResourceTag condition key."
      }
    ]
  }
]
```

`reasonType` is one of `false-positive`, `out-of-scope`, `by-design`, `accepted-risk`. Then:

```sh
node .claude/review/review.mjs next
```

It prints the next `REVIEW` plan (back to step 2) or `ABORT`.

## 5. Open the pull request

```sh
node .claude/review/review.mjs summary
```

Append its output to the pull request body. Commit everything the review saw, push, and then run `gh pr create` as a command of its own. The gate lets it through only when the working tree, `HEAD` and the pushed upstream all match what the review passed. If you change any file after `DONE`, the gate blocks again; run the skill from step 1.

## 6. Aborted

Stop. Do not restart, fix further, or open the pull request. Report to the user:

- `abort.kind` and `abort.message`
- each finding in `abort.findings` with its responses and the reviewer's replies (`node .claude/review/review.mjs status` shows them)

Then wait for the user's decision.
