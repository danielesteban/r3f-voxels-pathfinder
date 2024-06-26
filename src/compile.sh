#!/bin/sh
cd "${0%/*}"

clang --target=wasm32-unknown-wasi --sysroot=../../wasi-sysroot/ \
-nostartfiles -flto -Ofast \
-Wl,--import-undefined -Wl,--no-entry -Wl,--lto-O3 \
-Wl,--export=pathfind \
-o ./pathfinder.wasm ./pathfinder.c
