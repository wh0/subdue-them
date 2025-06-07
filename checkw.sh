#!/bin/sh
export PATH="$PATH:/opt/nvm/versions/node/v16/bin"
exec npx --yes --package typescript tsc -p jsconfig.json -w
