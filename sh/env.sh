#!/usr/bin/env bash

cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/../" &> /dev/null

ENV="${ENV:-.env}"

if [ -e "${ENV}" ]; then
    source "${ENV}"
fi
