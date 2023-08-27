#!/bin/bash

current_dir=$(pwd)

cd ./lib/native

node-gyp configure
node-gyp build

cp ./build/Release/locate.node $current_dir/src/locate.node

cd $current_dir