#!/bin/bash
unset TURBOPACK
exec ./node_modules/.bin/next build "$@"
