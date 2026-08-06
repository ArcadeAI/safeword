#!/bin/sh
set -eu

relay_data_directory=${RELAY_DATA_DIR:-/data}
if [ "$relay_data_directory" != /data ]; then
  echo "RELAY_DATA_DIR must be /data in the Railway container" >&2
  exit 1
fi

mkdir -p -- "$relay_data_directory"
chown -R node:node -- "$relay_data_directory"
exec gosu node "$@"
