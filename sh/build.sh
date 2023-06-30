#!/usr/bin/env bash

cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/../" &> /dev/null

IMAGE_TAG="${IMAGE_TAG:-$(make -s name)}"
IMAGE_NAME="global:${IMAGE_TAG}"
PORT="${PORT:-2000}"

make -s version-file

echo "building ${IMAGE_NAME}"

docker buildx build \
    --platform linux/amd64 \
    --build-arg "PORT=${PORT}" \
    -t "${IMAGE_NAME}" \
    -f deploy/Dockerfile \
    .

echo "built ${IMAGE_NAME}"

rm version.txt
