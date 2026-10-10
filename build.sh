#!/bin/sh
# Build store packages for Web Locker.
# Output:
#   dist/web-locker-<ver>-chrome-edge.zip   (service_worker manifest -> Chrome Web Store & Edge Add-ons)
#   dist/web-locker-<ver>-firefox.zip       (scripts manifest -> Firefox AMO, AMO will sign it)
# Usage: ./build.sh
set -eu
cd "$(dirname "$0")"

VER=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
FILES="manifest.json background.js content.js content.css popup.html popup.css popup.js LICENSE"
IMAGES="images/icon16.png images/icon32.png images/icon48.png images/icon128.png"

for f in $FILES $IMAGES; do
  [ -e "$f" ] || { echo "MISSING: $f"; exit 1; }
done
node --check background.js && node --check content.js && node --check popup.js
python3 -c "import json; json.load(open('manifest.json')); json.load(open('manifest.firefox.json')); print('manifests OK')"

rm -rf dist && mkdir -p dist/stage-firefox dist/stage-chrome
STAGE_CHROME="dist/stage-chrome"
STAGE_FF="dist/stage-firefox"

cp $FILES "$STAGE_CHROME/"
mkdir -p "$STAGE_CHROME/images" && cp $IMAGES "$STAGE_CHROME/images/"
cp $FILES "$STAGE_FF/" 2>/dev/null || true
mkdir -p "$STAGE_FF/images" && cp $IMAGES "$STAGE_FF/images/"
# Firefox uses the scripts-based background; the file must be named manifest.json
cp manifest.firefox.json "$STAGE_FF/manifest.json"
python3 -c "import json; m=json.load(open('$STAGE_FF/manifest.json')); assert m['background']=={'scripts':['background.js']}, m['background']; print('firefox manifest OK')"

CHROME_ZIP="dist/web-locker-$VER-chrome-edge.zip"
FF_ZIP="dist/web-locker-$VER-firefox.zip"
(cd "$STAGE_CHROME" && zip -q -r "../web-locker-$VER-chrome-edge.zip" .)
(cd "$STAGE_FF" && zip -q -r "../web-locker-$VER-firefox.zip" .)
rm -rf "$STAGE_CHROME" "$STAGE_FF"

echo "--- $CHROME_ZIP ---"; unzip -l "$CHROME_ZIP"
echo "--- $FF_ZIP ---"; unzip -l "$FF_ZIP"
ls -lh dist/
