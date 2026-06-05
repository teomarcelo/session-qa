#!/bin/bash
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ]; then
  echo "ERROR: You are on main. Switch to react-refactor before editing."
  exit 1
fi
exit 0
