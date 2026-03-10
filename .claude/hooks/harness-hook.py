#!/usr/bin/env python3
"""Harness post-session hook (installed by harness/install-hook.sh).

Runs the harness pipeline on this project's sessions and feeds data
back to the harness repo's EXP-002 ledger.
"""
import json
import os
import sys
from pathlib import Path

HARNESS_ROOT = Path("/Users/gpavanello/Repositories/harness")

def main():
    try:
        event_data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        event_data = {}

    session_id = event_data.get("session_id", "")
    cwd = event_data.get("cwd", os.getcwd())

    if not session_id:
        sys.exit(0)

    # Find transcript
    project_root = Path(cwd).resolve()
    claude_projects = Path.home() / ".claude" / "projects"
    encoded = str(project_root).replace("/", "-")
    transcript = claude_projects / encoded / f"{session_id}.jsonl"

    if not transcript.exists():
        sys.exit(0)

    # Import harness from the harness repo
    harness_src = HARNESS_ROOT / "src"
    sys.path.insert(0, str(harness_src))

    try:
        from harness.runtime import run_pipeline, save_report

        result = run_pipeline(
            transcript_path=transcript,
            project_root=project_root,
        )

        # Save report to harness repo's logs (cross-project data)
        logs_dir = HARNESS_ROOT / "research" / "sessions" / "logs"
        output_path = save_report(result, logs_dir)

        traction = result.get("traction", {})
        health = result.get("failures", {}).get("summary", {}).get("overall_health", "?")
        score = traction.get("score", 0)
        quality = result.get("quality_gate", {})
        gate_status = quality.get("summary", "N/A")
        print(
            f"[harness] External session analyzed: traction={score:.2f}, "
            f"health={health}, quality={gate_status}, report={output_path}",
            file=sys.stderr,
        )
    except Exception as e:
        print(f"[harness] External analysis failed: {e}", file=sys.stderr)

    sys.exit(0)

if __name__ == "__main__":
    main()
