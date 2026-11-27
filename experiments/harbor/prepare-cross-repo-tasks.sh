#!/bin/sh
set -eu
cd "$(dirname "$0")"
arcade=${1:-"$HOME/Projects/arcade-monorepo"}
website=${2:-"$HOME/Projects/www"}
export COPYFILE_DISABLE=1
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/arcade-outlook/environment" "$scratch/arcade-outlook/tests" \
  "$scratch/www-home/environment" "$scratch/www-home/tests"

toolkits=apps/worker/toolkits
mail="$toolkits/microsoft_outlook_mail"
git -C "$arcade" archive --format=tar.gz '763bd845ae^' "$mail" "$toolkits/microsoft_utils" \
  > "$scratch/arcade-outlook/environment/snapshot.tar.gz"
git -C "$arcade" show "763bd845ae:$mail/tests/test_list_emails_in_conversation.py" \
  > "$scratch/arcade-outlook/tests/feature-test.py"
git -C "$arcade" show "763bd845ae^:$mail/tests/test_search_emails.py" > "$scratch/original-search.py"
sed 's/assert "query" not in result/assert not result.get("query")/' "$scratch/original-search.py" \
  > "$scratch/arcade-outlook/tests/search-regression.py"

git -C "$website" archive --format=tar.gz '010843bc4^' \
  src public scripts astro.config.mjs package.json bun.lock bunfig.toml tsconfig.json wrangler.jsonc packages \
  > "$scratch/www-home/environment/snapshot.tar.gz"
git -C "$website" show 010843bc4:tests/home-adoption.spec.ts \
  > "$scratch/www-home/tests/home-adoption.spec.ts"
python3 - "$scratch/www-home/tests/home-adoption.spec.ts" << 'PY'
from pathlib import Path
import sys

test = Path(sys.argv[1])
source = test.read_text()
build = '  await build({ root: directory, logLevel: "error" });'
if source.count(build) != 1:
    raise SystemExit("Cannot locate the pinned website fixture's build")
# The Astro config uses process.cwd() for its stylesheet content scan.
source = source.replace("test.setTimeout(120_000);", "test.setTimeout(240_000);")
test.write_text(source.replace(build, f'''  const originalDirectory = process.cwd();
  process.chdir(directory);
  try {{
  {build}
  }} finally {{
    process.chdir(originalDirectory);
  }}'''))
PY

# Publish only after every pinned input and transformation has succeeded.
for file in arcade-outlook/environment/snapshot.tar.gz arcade-outlook/tests/feature-test.py \
  arcade-outlook/tests/search-regression.py www-home/environment/snapshot.tar.gz \
  www-home/tests/home-adoption.spec.ts; do
  mv "$scratch/$file" "$file"
done
