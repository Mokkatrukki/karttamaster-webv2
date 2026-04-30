#!/usr/bin/env bash
# Compact codebase snapshot. Usage: bash scan_project.sh [root]
ROOT="${1:-.}"; cd "$ROOT" || exit 1

if [ -f package.json ]; then
  node -e "
    const p=require('./package.json'),d={...p.dependencies,...p.devDependencies};
    const k=['vite','react','svelte','leaflet','vitest','jest','playwright','jsdom'];
    console.log('STACK: '+k.filter(x=>d[x]).map(x=>x+'@'+d[x].replace(/[\^~]/,'')).join(' '));
  " 2>/dev/null
fi

if [ -d src ]; then
  echo "SRC:"
  for f in src/*.ts; do
    [ -f "$f" ] || continue
    exports=$(grep -oE "export (function|class|const|async function|type|interface) [A-Za-z]+" "$f" 2>/dev/null \
      | awk '{print $NF}' | paste -sd ',' -)
    [ -n "$exports" ] && echo "  $(basename "$f" .ts): $exports"
  done
fi

if [ -d tests ]; then
  echo "TESTS:"
  for f in tests/*.ts; do
    [ -f "$f" ] || continue
    descs=$(grep -oE "describe\('[^']+'|describe\(\"[^\"]+\"" "$f" 2>/dev/null \
      | sed "s/describe(['\"]//;s/['\"]$//" | paste -sd ',' -)
    [ -n "$descs" ] && echo "  $(basename "$f"): $descs"
  done
  todos=$(grep -rh "it\.todo(" tests/ 2>/dev/null \
    | sed "s/.*it\.todo(['\"]//;s/['\"].*//")
  [ -n "$todos" ] && echo "TODOS:" && echo "$todos" | sed 's/^/  /'
fi

exit 0
