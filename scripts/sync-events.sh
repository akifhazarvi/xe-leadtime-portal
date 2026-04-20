#!/bin/bash
# Sync Events Registry
# Extracts event names from galileo-site and xe-apollo codebases
# and generates config/events-registry.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$PROJECT_DIR")"
OUTPUT="$PROJECT_DIR/config/events-registry.json"

GALILEO_DIR="$PARENT_DIR/galileo-site"
APOLLO_DIR="$PARENT_DIR/xe-apollo"

echo "=== Syncing Events Registry ==="

# Extract SEGMENT_EVENTS from galileo-site
echo "Extracting events from galileo-site..."
GALILEO_EVENTS=""
if [ -f "$GALILEO_DIR/src/constants/segmentAnalytics.ts" ]; then
  GALILEO_EVENTS=$(grep -oP ":\s*'[^']+'" "$GALILEO_DIR/src/constants/segmentAnalytics.ts" | sed "s/: *'//;s/'$//" | sort -u)
  GALILEO_COUNT=$(echo "$GALILEO_EVENTS" | wc -l | tr -d ' ')
  echo "  Found $GALILEO_COUNT events in SEGMENT_EVENTS"
else
  echo "  [WARN] galileo-site/src/constants/segmentAnalytics.ts not found"
fi

# Extract events from xe-apollo
echo "Extracting events from xe-apollo..."
APOLLO_EVENTS=""
if [ -d "$APOLLO_DIR/src" ]; then
  APOLLO_EVENTS=$(grep -roh "eventName: '[^']*'" "$APOLLO_DIR/src/" 2>/dev/null | sed "s/eventName: '//;s/'$//" | sort -u)
  APOLLO_COUNT=$(echo "$APOLLO_EVENTS" | wc -l | tr -d ' ')
  echo "  Found $APOLLO_COUNT events in xe-apollo"
else
  echo "  [WARN] xe-apollo/src/ not found"
fi

# Combine and deduplicate
ALL_EVENTS=$(echo -e "$GALILEO_EVENTS\n$APOLLO_EVENTS" | sort -u | grep -v '^$')
TOTAL=$(echo "$ALL_EVENTS" | wc -l | tr -d ' ')

echo ""
echo "Total unique events: $TOTAL"

# Generate JSON
echo "{" > "$OUTPUT"
echo '  "generated_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",' >> "$OUTPUT"
echo '  "galileo_site_count": '$GALILEO_COUNT',' >> "$OUTPUT"
echo '  "xe_apollo_count": '${APOLLO_COUNT:-0}',' >> "$OUTPUT"
echo '  "total_unique": '$TOTAL',' >> "$OUTPUT"
echo '  "events": [' >> "$OUTPUT"

FIRST=true
while IFS= read -r event; do
  if [ -z "$event" ]; then continue; fi

  # Determine source
  IN_GALILEO=false
  IN_APOLLO=false
  echo "$GALILEO_EVENTS" | grep -qF "$event" && IN_GALILEO=true
  echo "$APOLLO_EVENTS" | grep -qF "$event" && IN_APOLLO=true

  SOURCE="[]"
  if $IN_GALILEO && $IN_APOLLO; then
    SOURCE='["galileo-site", "xe-apollo"]'
  elif $IN_GALILEO; then
    SOURCE='["galileo-site"]'
  elif $IN_APOLLO; then
    SOURCE='["xe-apollo"]'
  fi

  if $FIRST; then
    FIRST=false
  else
    echo "," >> "$OUTPUT"
  fi

  printf '    {"name": "%s", "sources": %s}' "$event" "$SOURCE" >> "$OUTPUT"

done <<< "$ALL_EVENTS"

echo "" >> "$OUTPUT"
echo "  ]" >> "$OUTPUT"
echo "}" >> "$OUTPUT"

echo ""
echo "Events registry written to: $OUTPUT"
echo "Done!"
