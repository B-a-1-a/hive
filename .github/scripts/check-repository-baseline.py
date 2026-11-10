"""Check import provenance and standalone documents; this is not an app build."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

def sha256(path):
    if not path.is_file():
        errors.append(f'Missing file: {path.relative_to(ROOT)}')
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.html = False
        self.body = False
        self.external_scripts = []
    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        self.html |= tag == 'html'
        self.body |= tag == 'body'
        if tag == 'script' and attributes.get('src'):
            self.external_scripts.append(attributes['src'])

try:
    data = json.loads((ROOT / 'UPSTREAM.json').read_text())
except (OSError, json.JSONDecodeError) as error:
    sys.exit(f'Invalid UPSTREAM.json: {error}')

require(data.get('upstream_repository') == 'https://github.com/pingdotgg/t3code', 'Unexpected upstream repository')
require(data.get('upstream_tag') == 'v0.1.2', 'Unexpected baseline release')
require(data.get('upstream_commit') == '044f07257c9684ae4543bd1e1ebf9c394e9e3830', 'Unexpected baseline commit')
require(data.get('upstream_tree') == 'e1375be63572f876adb8073791e6fe27347bc0d7', 'Unexpected upstream tree')
require(bool(re.fullmatch(r'[0-9a-f]{64}', data.get('source_archive', {}).get('sha256', ''))), 'Archive checksum missing or invalid')
require(data.get('verification', {}).get('archive_git_tree_matches_upstream') is True, 'Import tree verification is not recorded')
for item in data.get('licenses', {}).values():
    if isinstance(item, dict):
        require(sha256(ROOT / item['path']) == item['sha256'], f'Preserved license changed: {item["path"]}')
require(sha256(ROOT / 'README.upstream.md') == data.get('upstream_readme_sha256'), 'Preserved upstream README changed')

workflows = data.get('archived_workflows', [])
require(len(workflows) == 18, 'Expected 18 preserved upstream workflows')
for item in workflows:
    archived = ROOT / item['archived_path']
    require(item['archived_path'].startswith('.github/upstream-workflows/t3-v0.1.2/'), 'Invalid archived workflow location')
    require(sha256(archived) == item['sha256'], f'Archived workflow changed: {item["archived_path"]}')
    require(not (ROOT / item['original_path']).exists(), f'Upstream workflow is active: {item["original_path"]}')

for item in data.get('gitlinks', []):
    record = subprocess.check_output(['git', 'ls-files', '--stage', '--', item['path']], cwd=ROOT, text=True).strip()
    require(record.startswith(f'160000 {item["commit"]} '), f'Missing or changed reference submodule: {item["path"]}')

for directory in ['apps/desktop', 'apps/server', 'apps/web', 'packages/contracts', 'packages/provider-core']:
    require((ROOT / directory).is_dir(), f'Missing inherited source directory: {directory}')

for name in ['product-outline.html', 'browser-wireframes.html']:
    path = ROOT / 'docs/design' / name
    if not path.is_file():
        errors.append(f'Missing standalone document: {name}')
        continue
    parser = Document()
    parser.feed(path.read_text())
    require(parser.html and parser.body, f'Not a complete HTML document: {name}')
    require(not parser.external_scripts, f'Document needs external scripts: {name}')

active = sorted(path.name for path in (ROOT / '.github/workflows').glob('*.yml'))
require(active == ['application-checks.yml', 'repository-checks.yml'], 'Unexpected active workflow; review before enabling additional automation')
if errors:
    for error in errors:
        print(f'ERROR: {error}', file=sys.stderr)
    sys.exit(1)
print('Repository baseline passed: provenance, preserved licenses, archived workflows, reference submodules, and standalone HTML.')
print('Application build, provider authentication, and desktop runtime validation belong to the owner bootstrap.')
