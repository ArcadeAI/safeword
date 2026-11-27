#!/bin/sh
set -eu
cd "$(dirname "$0")"
repo=${1:-"$HOME/Projects/bdd-extractor"}
scratch=$(mktemp -d)
trap 'python3 -c "import shutil,sys; shutil.rmtree(sys.argv[1])" "$scratch"' EXIT

git -C "$repo" show feb9475ffd837891897901e7c3f3867d38b0348a:packages/extractor/src/trace.ts > "$scratch/trace-good.ts"
python3 - "$scratch" << 'PY'
from pathlib import Path
import sys

scratch = Path(sys.argv[1])
good = (scratch / "trace-good.ts").read_text()
anchor = "  if (report.matched.length === 0) {"
assert good.count(anchor) == 1
assert "const errorEntries:" in good
for label, message in [
    ("trace-partial-outage", "every area failed"),
    ("trace-partial-no-matches", "no matches"),
]:
    mutation = f"  if (report.matched.length > 0 && errorEntries.length > 0) throw new Error('{message}');\n"
    (scratch / f"{label}.ts").write_text(good.replace(anchor, mutation + anchor))
PY

cat > "$scratch/reservation-good.mjs" << 'JS'
const reserved = new Set();
export function reserve(inventory, itemId, requestId) {
  if (reserved.has(requestId)) return { status: 'reserved', inventory };
  if (!inventory[itemId]) return { status: 'sold-out', inventory };
  reserved.add(requestId);
  return { status: 'reserved', inventory: { ...inventory, [itemId]: inventory[itemId] - 1 } };
}
JS
sed "s/if (reserved.has(requestId)) return { status: 'reserved'/if (reserved.has(requestId)) return { status: 'sold-out'/" \
  "$scratch/reservation-good.mjs" > "$scratch/reservation-wrong-retry.mjs"
python3 - "$scratch" << 'PY'
from pathlib import Path
import sys

scratch = Path(sys.argv[1])
good = (scratch / "reservation-good.mjs").read_text()
retry = "  if (reserved.has(requestId)) return { status: 'reserved', inventory };"
stock = "  if (!inventory[itemId]) return { status: 'sold-out', inventory };"
assert retry + "\n" + stock in good
(scratch / "reservation-last-unit.mjs").write_text(
    good.replace(retry + "\n" + stock, stock + "\n" + retry)
)
PY

# The Docker images are the same task environments used by Harbor.
docker build -q -t safeword-harbor-proof-base:1.1.0 false-done/environment
docker build -q -t safeword-harbor-calibration-reservation reservation/environment
docker build -q --target baseline -t safeword-harbor-calibration-trace extractor-trace-empty/environment

check() {
  fixture=$1 image=$2 expected=$3 label=$4
  shift 4
  log="$scratch/$label.log"
  if ! docker run --rm --network none \
    --mount "type=bind,source=$PWD/$fixture/tests,target=/tests,readonly" \
    "$@" "$image" sh -eu -c 'sh /tests/test.sh >&2; cat /logs/verifier/reward.txt' \
    > "$scratch/reward" 2> "$log"; then
    cat "$log" >&2
    printf '%s: verifier did not finish\n' "$label" >&2
    return 1
  fi
  reward=$(cat "$scratch/reward")
  if [ "$reward" != "$expected" ]; then
    cat "$log" >&2
    printf '%s expected %s, got %s\n' "$label" "$expected" "$reward" >&2
    return 1
  fi
  case "$label" in
    reservation-starter) diagnostic='Reservation handling is not implemented' ;;
    reservation-wrong-retry | reservation-last-unit) diagnostic='AssertionError' ;;
    trace-starter) diagnostic='got: (nothing thrown)' ;;
    trace-partial-*) diagnostic='at async testFailureDegradation' ;;
    *) diagnostic= ;;
  esac
  if [ -n "$diagnostic" ] && ! grep -Fq "$diagnostic" "$log"; then
    cat "$log" >&2
    printf '%s: expected failure evidence %s\n' "$label" "$diagnostic" >&2
    return 1
  fi
  printf '%s: %s\n' "$label" "$reward"
}

check reservation safeword-harbor-calibration-reservation 0 reservation-starter
for label in reservation-good reservation-wrong-retry reservation-last-unit; do
  expected=0
  if [ "$label" = reservation-good ]; then expected=1; fi
  check reservation safeword-harbor-calibration-reservation "$expected" "$label" \
    --mount "type=bind,source=$scratch/$label.mjs,target=/app/task.mjs,readonly"
done

check extractor-trace-empty safeword-harbor-calibration-trace 0 trace-starter
for label in trace-good trace-partial-outage trace-partial-no-matches; do
  expected=0
  if [ "$label" = trace-good ]; then expected=1; fi
  check extractor-trace-empty safeword-harbor-calibration-trace "$expected" "$label" \
    --mount "type=bind,source=$scratch/$label.ts,target=/app/packages/extractor/src/trace.ts,readonly"
done
