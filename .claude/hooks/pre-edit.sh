#!/bin/bash
BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$BRANCH" = "main" ]; then
  echo "ERROR: You are on the main branch. Switch to a feature branch before editing files."
  exit 1
fi
exit 0
