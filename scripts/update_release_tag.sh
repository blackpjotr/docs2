#!/usr/bin/env bash

SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

cd $SCRIPT_DIR/..

if [[ "$1" == "-h" || "$1" == "--help" || $# -ne 2 ]]; then
    cat << EOF
Usage: ${0##*/} [-h|--help] <new_mainnet_tag> <new_devnet_tag>

This script take new_mainnet_tag and new_devnet_tag, scan through the whole repo
and replace old tags them with provided new tags.

    -h|--help  display this help and exit
EOF
    exit 0
fi

NEW_MAINNET_TAG="$1"
NEW_DEVNET_TAG="$2"

# Unified function: handles reading, logging, and replacing
process_tag() {
  local json_key="$1"
  local new_value="$2"

  local old_value
  old_value=$(jq -r "$json_key" ./metadata.json)

  if [ -z "$old_value" ]; then
    echo "Failed to read $json_key from metadata.json"
    exit 1
  fi

  echo "  $json_key: $old_value → $new_value"

  escaped_old_value=$(printf '%s\n' "$old_value" | sed 's/[\/&]/\\&/g')
  escaped_new_value=$(printf '%s\n' "$new_value" | sed 's/[\/&]/\\&/g')

  grep -rl --exclude-dir=.git "$old_value" . | while read -r file; do
    sed -i "s/$escaped_old_value/$escaped_new_value/g" "$file"
  done
}

echo "Replacing release tags:"
process_tag '.release.tags.mainnet' "$NEW_MAINNET_TAG"
process_tag '.release.tags.devnet' "$NEW_DEVNET_TAG"

echo "Replacement complete."
