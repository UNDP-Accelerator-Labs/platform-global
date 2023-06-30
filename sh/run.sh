#!/usr/bin/env bash

cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/../" &> /dev/null

if [ -z "${CMD}" ]; then
    echo "specify a command via CMD"
    exit 1
fi

source ./sh/env.sh

npm run "${CMD}" "$@"
