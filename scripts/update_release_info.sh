#!/usr/bin/env bash

SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

cd $SCRIPT_DIR/..

function usage() {
    local errmsg="$1"
    if [[ -n "$errmsg" ]]; then
        echo "Error: $errmsg"
        echo
    fi
    cat << EOF
Usage: ${0##*/} [--devnet-tag <new_devnet_tag>] [--mainnet-tag <new_mainnet_tag>]
  --devnet-tag     The new devnet tag to use
  --mainnet-tag    The new mainnet tag to use

This script takes old release info, scan through the whole repo and replace old
tags them with provided new tags.
EOF
    exit 1
}

while [[ "$#" -gt 0 ]]; do case $1 in
  --devnet-tag) NEW_DEVNET_TAG="$2"; shift;;
  --mainnet-tag) NEW_MAINNET_TAG="$2"; shift;;
  *) usage "Unknown parameter passed: $1";;
esac; shift; done

if [[ -z "$NEW_DEVNET_TAG" && -z "$NEW_MAINNET_TAG" ]]; then
  usage "Nothing to update."
fi

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
    cd docs && sed -i "s/$escaped_old_value/$escaped_new_value/g" "$file"
  done
}

echo "Replacing release tags"
[ -z "$NEW_MAINNET_TAG"] || process_tag '.release.tags.mainnet' "$NEW_MAINNET_TAG"
[ -z "$NEW_DEVNET_TAG"] || process_tag '.release.tags.devnet' "$NEW_DEVNET_TAG"
echo "Replacement complete, please check if there's any false positives"
