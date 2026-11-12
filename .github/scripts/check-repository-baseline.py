"""Validate the pinned Hive import and retained source notices."""
from pathlib import Path
import hashlib
import json
import re
import sys
import subprocess

ROOT = Path(__file__).resolve().parents[2]
errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

def sha256(path):
    if not path.is_file():
        errors.append(f"Missing file: {path.relative_to(ROOT)}")
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()

try:
    data = json.loads((ROOT / "UPSTREAM.json").read_text())
except (OSError, json.JSONDecodeError) as error:
    sys.exit(f"Invalid UPSTREAM.json: {error}")

require(data.get("project") == "Hive", "Unexpected app identity")
require(data.get("upstream_repository") == "https://github.com/pingdotgg/t3code", "Unexpected upstream")
require(data.get("upstream_tag") == "v0.1.9", "Unexpected baseline release")
require(data.get("upstream_commit") == "24e77473ecf41bc1f7142529c7911c1c1aae1d76", "Unexpected baseline commit")
require(bool(re.fullmatch(r"[0-9a-f]{64}", data.get("source_archive", {}).get("sha256", ""))), "Missing archive checksum")
for item in data.get("licenses", {}).values():
    require(sha256(ROOT / item["path"]) == item["sha256"], f"Preserved license changed: {item['path']}")
require(sha256(ROOT / "README.upstream.md") == data.get("upstream_readme_sha256"), "Preserved upstream README changed")
workflows = data.get("archived_workflows", [])
require(bool(workflows), "Missing upstream workflow archive")
for item in workflows:
    require(item["archived_path"].startswith(".github/upstream-workflows/t3-v0.1.9/"), "Unexpected workflow archive path")
    require(sha256(ROOT / item["archived_path"]) == item["sha256"], f"Archived workflow changed: {item['archived_path']}")
    require(not (ROOT / item["original_path"]).exists(), f"Upstream publishing workflow is active: {item['original_path']}")
for directory in ["apps/desktop", "apps/server", "apps/web", "packages/contracts", "packages/provider-core", "packages/provider-cursor", "packages/provider-opencode", "packages/provider-grok", "packages/provider-fx", "packages/provider-kiro"]:
    require((ROOT / directory).is_dir(), f"Missing inherited source: {directory}")
tracked = subprocess.check_output(["git", "ls-files", "--stage"], cwd=ROOT, text=True)
for line in tracked.splitlines():
    if line.startswith("160000 "):
        path = line.split("\t", 1)[1]
        mappings = subprocess.check_output(["git", "config", "--file", ".gitmodules", "--get-regexp", r"submodule\..*\.path"], cwd=ROOT, text=True)
        require(any(entry.split(" ", 1)[1] == path for entry in mappings.splitlines()), f"Missing reference submodule mapping: {path}")
active = sorted(p.name for p in (ROOT / ".github/workflows").glob("*.yml"))
require(active == ["application-checks.yml", "repository-checks.yml"], "Unexpected active automation")
if errors:
    sys.exit("\n".join(f"ERROR: {error}" for error in errors))
print("Repository baseline passed: stable source record, preserved licenses, providers and archived upstream automation.")
