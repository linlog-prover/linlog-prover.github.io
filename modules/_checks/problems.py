# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# The store of problems against linlog's command at the flake's pinned input:
# every problem's verdict and fragment are the ones `linlog prove` gives (one
# batch, deterministic, a time limit each), every provable problem has a
# session of its very sequent and mode that `linlog interact --state` resumes
# and `proof` accepts (exit 0), and no unprovable problem has one. A store
# entry without that evidence, or one whose verdict a later linlog changes,
# fails the check, which names it.
# Usage: python3 problems.py PROBLEMS_DIR LINLOG
import json
import pathlib
import subprocess
import sys
import tempfile

FLAGS = {
    "classical": [],
    "affine": ["--affine"],
    "mix": ["--mix"],
    "affine-mix": ["--affine", "--mix"],
    "intuitionistic": ["--intuitionistic"],
    "intuitionistic-affine": ["--intuitionistic", "--affine"],
}
VERDICT = {"provable": "proved", "unprovable": "unprovable"}


def front_matter(path):
    # The store's Markdown starts with `key: value` lines between two `---`,
    # each value a JSON string, a number or a [list].
    lines = path.read_text(encoding="utf-8").split("\n")
    assert lines[0] == "---", f"{path.name}: no front matter"
    meta = {}
    for line in lines[1 : lines.index("---", 1)]:
        key, value = line.split(": ", 1)
        meta[key] = json.loads(value) if value[0] in '"0123456789' else value
    return meta


def main(store, linlog):
    problems = {p.stem: front_matter(p) for p in sorted(store.glob("*.md"))}
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        batch = pathlib.Path(tmp) / "store.jsonl"
        batch.write_text(
            "".join(
                json.dumps({"name": pid, "mode": p["mode"], "sequent": p["sequent"]})
                + "\n"
                for pid, p in problems.items()
            )
        )
        run = subprocess.run(
            [
                linlog,
                "prove",
                "--input-format",
                "jsonl",
                "--format",
                "json",
                "--deterministic",
                "--timeout",
                "20s",
                "--file",
                str(batch),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        outcomes = {}
        for line in run.stdout.splitlines():
            record = json.loads(line)
            outcomes[record["name"]] = record
        for pid, p in problems.items():
            outcome = outcomes.get(pid)
            if outcome is None:
                failures.append(f"{pid}: linlog answered nothing")
                continue
            if outcome["verdict"] != VERDICT.get(p["verdict"]):
                failures.append(
                    f"{pid}: the store says {p['verdict']}, linlog says {outcome['verdict']}"
                )
                continue
            if outcome.get("fragment") != p["fragment"]:
                failures.append(
                    f"{pid}: the store says {p['fragment']}, linlog detects {outcome.get('fragment')}"
                )
            session = store / f"{pid}.session.json"
            if p["verdict"] == "unprovable":
                if session.exists():
                    failures.append(f"{pid}: an unprovable problem with a session")
                continue
            if not session.exists():
                failures.append(f"{pid}: provable, but no session proves it")
                continue
            doc = json.loads(session.read_text(encoding="utf-8"))
            if doc.get("mode") != p["mode"] or doc.get("sequent") != outcome["sequent"]:
                failures.append(
                    f"{pid}: its session is not of its sequent in {p['mode']} mode"
                )
                continue
            checked = subprocess.run(
                [linlog, "interact", "--state", str(session)],
                input="proof\n",
                capture_output=True,
                text=True,
                check=False,
            )
            if checked.returncode != 0:
                failures.append(
                    f"{pid}: `proof` refuses its session (exit {checked.returncode})"
                )
    if failures:
        sys.exit(
            f"{len(failures)} of {len(problems)} problems fail:\n" + "\n".join(failures)
        )
    proved = sum(1 for p in problems.values() if p["verdict"] == "provable")
    print(
        f"all {len(problems)} problems are as linlog's command decides them; "
        f"{proved} provable, each with a session that `proof` accepts"
    )


main(pathlib.Path(sys.argv[1]), sys.argv[2])
