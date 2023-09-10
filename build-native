#!/bin/bash

current_dir=$(pwd)

cd ./native

node-gyp configure
node-gyp build

cp ./build/Release/locate.node $current_dir/lib/locate.node

cd $current_dir