#!/usr/bin/env bash

cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/../" &> /dev/null

ARG=$1

if [ ! -z "${ARG}" ]; then
    echo "$0"
    echo "interactively creates a new user in the login db (as specified in the env file)"
    exit 1
fi

source ./sh/env.sh

read_var () {  # <variable> <prompt> <default> <is_secure>
    local VAR_NAME=$1
    local PROMPT=$2
    local DEFAULT=$3
    local IS_SECURE=$4
    if [ ! -z "${DEFAULT}" ]; then
        PROMPT="${PROMPT} (${DEFAULT}):"
    else
        PROMPT="${PROMPT}:"
    fi
    local OUT=
    while [ -z "${OUT}" ]; do
        if [ "${IS_SECURE}" == 0 ]; then
            read -p "${PROMPT}" OUT
        else
            read -s -p "${PROMPT}" OUT
            echo ""
            # NOTE: uncomment to allow empty secrets
            # if [ -z "${DEFAULT}" ]; then
            #     break
            # fi
        fi
        if [ -z "${OUT}" ]; then
            if [ -z "${DEFAULT}" ]; then
                echo "Value is required!"
            else
                OUT="${DEFAULT}"
            fi
        fi
    done
    if [ ! -z "${OUT}" ]; then
        OUT=$(printf '%q' "${OUT}")
    fi
    eval "${VAR_NAME}=${OUT}"
}

read_var USER_NAME "Full Name" "" 0
read_var USER_EMAIL "Email" "" 0
read_var USER_POS "Position" "" 0
read_var USER_ISO "ISO3 Country" "NUL" 0
read_var USER_PERM "Permissions" 0 0
read_var USER_PW "Password" "" 1

SQL=$(cat <<EOF
INSERT INTO users (iso3, position, name, email, password, rights)
VALUES (
    :'user_iso',
    :'user_pos',
    :'user_name',
    :'user_email',
    crypt(:'user_pw', GEN_SALT('bf', 8)),
    :'user_perm');
EOF)

./sh/psql.sh \
    "${SQL}" \
    -v "user_iso=${USER_ISO}" \
    -v "user_pos=${USER_POS}" \
    -v "user_name=${USER_NAME}" \
    -v "user_email=${USER_EMAIL}" \
    -v "user_pw=${USER_PW}" \
    -v "user_perm=${USER_PERM}"
