#!/bin/sh
set -e
TOOLCHAIN="${ANDROID_TOOLCHAIN:-/tmp/android/toolchain}"
BT="$TOOLCHAIN/android-14"
PLATFORM="$TOOLCHAIN/android-34/android.jar"
JDK="$TOOLCHAIN/jdk-17.0.21.1+2"
PATH="$JDK/bin:$PATH"
cd "$(dirname "$0")"

rm -rf build
mkdir -p build/gen build/obj build/apk

"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk \
    -I "$PLATFORM" \
    --manifest AndroidManifest.xml \
    -R build/res.zip \
    --java build/gen \
    --auto-add-overlay

javac -source 8 -target 8 \
    -bootclasspath "$PLATFORM:$BT/core-lambda-stubs.jar" \
    -classpath "build/gen:$BT/core-lambda-stubs.jar" \
    -d build/obj \
    $(find java build/gen -name '*.java')

"$BT/d8" --release --lib "$PLATFORM" --min-api 26 \
    --output build/apk $(find build/obj -name '*.class')

python3 - <<'PY'
import zipfile, os
src = 'build/base.apk'
dst = 'build/unsigned.apk'
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        zout.writestr(item, zin.read(item.filename))
    with open('build/apk/classes.dex', 'rb') as f:
        zi = zipfile.ZipInfo('classes.dex')
        zi.compress_type = zipfile.ZIP_STORED
        zout.writestr(zi, f.read())
print('dex packed')
PY

keytool -genkeypair -keystore build/debug.keystore -storepass android \
    -keypass android -alias androiddebugkey -dname "CN=Android Debug,O=Android,C=US" \
    -keyalg RSA -keysize 2048 -validity 10000 2>/dev/null || true

"$BT/zipalign" -f 4 build/unsigned.apk build/aligned.apk
"$BT/apksigner" sign --ks build/debug.keystore --ks-pass pass:android \
    --key-pass pass:android --out AiMascots.apk build/aligned.apk
"$BT/apksigner" verify AiMascots.apk && echo "BUILD OK: AiMascots.apk"
