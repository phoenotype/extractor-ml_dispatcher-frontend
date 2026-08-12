import subprocess
from pathlib import Path

root = Path("/mnt/c/Users/alessandro.garbossa/.gemini/extractor-ml_dispatcher-frontend")
msg = Path("/tmp/dispatcher_commit_msg.txt")
msg.write_text(
    "Add enterprise Vite dispatcher SPA with BFF and visual editor.\n\n"
    "Ship Flow list/editor against the dispatcher API contract, Lucy UI, "
    "TanStack Query, simulation/run guards, and a server-side proxy for private Cloud Run.\n",
    encoding="utf-8",
)

def run(args: list[str]) -> str:
    result = subprocess.run(
        args,
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return (result.stdout or "").strip()

scripts = root / "scripts"
if scripts.exists() and not any(scripts.iterdir()):
    scripts.rmdir()

run(["git", "add", "-A"])
status = run(["git", "status", "--short"])
print(status)

tree = run(["git", "write-tree"])
parent = run(["git", "rev-parse", "HEAD"])
new = run(["git", "commit-tree", tree, "-p", parent, "-F", str(msg)])
run(["git", "reset", "--soft", new])
print("COMMIT", run(["git", "log", "-1", "--oneline"]))
print(run(["git", "log", "-1", "--format=%B"]))
print(run(["git", "status", "-sb"]))
