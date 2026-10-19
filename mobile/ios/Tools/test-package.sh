#!/usr/bin/env bash
# Runs the VirtualBizKit tests. With full Xcode selected this is just `swift test`.
# With only the Command Line Tools selected, Swift Testing lives outside the default search
# paths, so the framework and rpath flags are added.
set -euo pipefail
cd "$(dirname "$0")/../Packages/VirtualBizKit"
DEV_DIR="$(xcode-select -p)"
if [[ "$DEV_DIR" == *CommandLineTools* ]]; then
  FW="$DEV_DIR/Library/Developer/Frameworks"
  LIB="$DEV_DIR/Library/Developer/usr/lib"
  exec swift test -Xswiftc -F -Xswiftc "$FW" -Xlinker -F -Xlinker "$FW" \
    -Xlinker -rpath -Xlinker "$FW" -Xlinker -rpath -Xlinker "$LIB" "$@"
fi
exec swift test "$@"
