#!/bin/bash
# $CLAUDE_TOOL_INPUT_FILE_PATH is passed by Claude Code for post-edit hooks
EDITED_FILE="${CLAUDE_TOOL_INPUT_FILE_PATH:-$1}"
BASENAME=$(basename "$EDITED_FILE")

if [[ "$BASENAME" == "firestore.rules" || "$BASENAME" == "storage-cors.json" || "$BASENAME" == "storage.rules" ]]; then
  echo "⚠️  SECURITY FILE MODIFIED: $BASENAME"
  echo "   This file affects live production security."
  echo "   Verify this change is intentional before pushing to GitHub."
fi

exit 0
