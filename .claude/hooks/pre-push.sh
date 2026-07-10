#!/bin/bash
# Hook output must be valid JSON for tool runners that parse hook responses.
if ! npm run build >/dev/null 2>&1; then
  echo '{"continue":false,"stopReason":"Build failed in pre-push hook. Run npm run build and fix errors before pushing."}'
  exit 0
fi
echo '{"continue":true}'
exit 0
