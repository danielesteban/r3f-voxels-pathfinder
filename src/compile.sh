#!/bin/sh
cd "${0%/*}"
WASI_SDK_PATH=../../wasi-sdk-22.0
${WASI_SDK_PATH}/bin/clang \
--sysroot=${WASI_SDK_PATH}/share/wasi-sysroot \
-nostartfiles \
-flto \
-Ofast \
-Wl,--no-entry \
-Wl,--lto-O3 \
-Wl,--import-undefined \
-Wl,--export=pathfind \
-o ./pathfinder.wasm pathfinder.c
