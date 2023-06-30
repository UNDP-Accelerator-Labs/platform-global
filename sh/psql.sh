#!/usr/bin/env bash

cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/../" &> /dev/null

if [ \( "$#" == 0 \) -o \( "$1" == "-h" \) -o \( "$1" == "--help" \) ]; then
    echo "$0 <sql> [...]"
    echo "executes the given sql query on the login db from the env file"
    echo "all other arguments are forwarded to psql"
    echo "the password must be typed manually"
    exit 1
fi

SQL="$1"; shift

source ./sh/env.sh

echo "${SQL}" | psql \
    -d "host=${LOGIN_DB_HOST} port=${LOGIN_DB_PORT} dbname=${LOGIN_DB_NAME} user=${LOGIN_DB_USERNAME}" \
    "$@"
