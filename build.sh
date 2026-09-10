#!/bin/bash
echo "Building obfuscated index..."
javascript-obfuscator index.js \
 --output index.obf.js \
 --compact true \
 --string-array true \
 --string-array-threshold 0.75
echo "Restarting bot..."
pm2 restart Architect-CG223 --update-env
echo "Done."
