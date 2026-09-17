# Review protocol

Every reviewer agent follows this file. The loop around you is run by `.claude/review/review.mjs`; you only review and return one JSON object.

## Inputs

The prompt gives you two paths and a category list:

- **Diff** — in round 1, everything this branch changes in the files assigned to you. From round 2, only what changed since the previous round, which is mostly fixes for earlier findings. It can be empty.
- **Carried findings** — findings from earlier rounds that are still open, with the author's latest response (`lastResponse`): `fix` means they changed code for it, `dispute` means they disagree and give a `reasonType` and `reason`.

Read the surrounding code in the repository whenever the diff is not enough. Do not review code the diff does not touch, except to judge the impact of the change.

## Tools

You are read-only, and hooks enforce it:

- `Read`, `Grep`, `Glob`, `WebFetch` and `WebSearch` work as usual. Nothing that writes or edits files is allowed.
- `Bash` runs only these commands:
  - `git diff|show|log|status|blame|rev-parse|ls-files ...`, without `--output`, `--ext-diff`, `--textconv` (in any abbreviation) or `-O`
  - `grep ...` and `rg ...` to search, without ripgrep's `--pre`, `--search-zip`/`-z` or `--hostname-bin`
  - `pnpm exec vp check [paths]`
  - `CI=1 pnpm exec vp test run [paths]`; `CI=1` keeps Vitest from writing snapshots

  Outside quotes, use only letters, digits, spaces and `_ . / : @ % ^ , + = ~ -`; put regular expressions and anything else in single quotes. Double quotes may not contain `$`, a backquote, a backslash or `!`. The `vp` commands take paths only and may be prefixed with `mise exec -- `. Anything else is refused; read the code instead of trying to run it.

## Output

Your final message is this JSON object and nothing else (a single ```json fence around it is fine):

```json
{
  "replies": [
    { "id": "cdk-R1-2", "verdict": "withdraw", "comment": "Fixed: the ID is now a literal." }
  ],
  "findings": [
    {
      "file": "src/workstation.ts",
      "line": 42,
      "severity": "high",
      "confidence": "confirmed",
      "category": "construct-id",
      "summary": "One sentence stating the defect.",
      "failure_scenario": "Concrete input or state -> wrong result."
    }
  ]
}
```

Both arrays are required, even when empty. A hook validates the object when you finish and saves it. If it is rejected, you are told why and must reply again with the corrected object.

### replies

Reply to **every** carried finding, and to nothing else.

- `withdraw` — you no longer raise it: the fix works, or the dispute's evidence refutes the finding. Only you can close a finding.
- `maintain` — it still stands. Say in `comment` why the fix is insufficient or why the dispute does not hold. Answer the author's reason directly; do not just repeat the finding.

A dispute comes with `evidence`, each item a `source` (a `file:line`, a URL, or a command) and a `detail` saying what it shows. Check every item yourself: open the file, fetch the page, run the read-only command. Then decide.

- Withdraw only when evidence you verified shows the finding is wrong. A confident tone, a repeated argument, or the author's wish to move on is not evidence.
- If an item does not say what the author claims, or does not address the failure scenario, maintain and name that item in `comment`.
- If the evidence shows you were partly wrong, withdraw and raise the part that still stands as a new finding with a narrower `summary`.

Do not re-report a carried finding under `findings`.

### findings

New defects only. One finding per defect. `file` is relative to the repository root, `line` is the line in the new version (0 if it has none). `category` must be one of the categories in your prompt.

## Severity

| Level      | Meaning                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `critical` | Breaks deployment, destroys or replaces stateful resources, exposes data or credentials, or grants access to unintended principals.             |
| `high`     | Wrong behavior on a normal path, a public API that cannot be fixed later without a breaking change, or permissions clearly broader than needed. |
| `medium`   | Wrong behavior on an edge path, a missing test for a risky change, or a maintainability problem that is likely to cause a bug.                  |
| `low`      | Naming, style, wording, or a small improvement with no behavioral effect.                                                                       |

## Confidence

| Level       | Meaning                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `confirmed` | You traced it in the code and can name the concrete input or state that fails.                          |
| `likely`    | The evidence is strong but depends on one thing you could not verify (runtime value, service behavior). |
| `possible`  | A suspicion worth mentioning. You could not show how it fails.                                          |

Only findings at `medium` or above **and** `likely` or above make the author fix or dispute them. Lower findings are recorded in the pull request. Rate honestly: inflating a finding forces a round, deflating one hides a defect.
