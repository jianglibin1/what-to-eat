#!/bin/bash
set -e
cd /workspace/what-to-eat
CI=true pnpm build
npx cap copy ios
echo "Done! Open ios/App/App.xcworkspace in Xcode"
