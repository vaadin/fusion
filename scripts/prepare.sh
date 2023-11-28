#!/usr/bin/env bash

# use hilla version from the root hilla npm modules package json
# cannot use maven project.version here, as file generation happens before building maven
version=`jq .version packages/ts/generator-typescript-core/package.json | cut -d '"' -f 2`
# TODO: compute this number when we maintain multiple hilla branches
branch=24.2.5

# download needed files from vaadin/platform
url=https://raw.githubusercontent.com/vaadin
results=./scripts/generator/results/
src=./scripts/generator/src/
mkdir -p $results
mkdir -p $src
# Take versions.json
curl -L -s "${url}/platform/${branch}/versions.json" > ${results}/versions.json
perl -pi -e 's/.*{{version}}.*\n//g' ${results}/versions.json
# Take scripts (this allows us not maintain the same scripts twice)
for i in creator replacer transformer writer
do
 [ ! -f "${src}/${i}.js" ] && curl -L -s "${url}/platform/${branch}/${src}/${i}.js" > ${src}/${i}.js
done

# run the generator
cmd="node scripts/generator/generate.js $version scripts/generator/results/versions.json"
echo Running: "$cmd" >&2
$cmd || exit 1

# copy generated poms to the final place
cp scripts/generator/results/hilla-versions.json packages/java/hilla/hilla-versions.json
cp scripts/generator/results/hilla-react-versions.json packages/java/hilla-react/hilla-react-versions.json

echo "Copied the theme file from flow-components to hilla and hilla-react"
# download the file from flow-components
lumoFile="${url}/flow-components/${branch}/vaadin-lumo-theme-flow-parent/vaadin-lumo-theme-flow/src/main/java/com/vaadin/flow/theme/lumo/Lumo.java"
materialFile="${url}/flow-components/${branch}/vaadin-material-theme-flow-parent/vaadin-material-theme-flow/src/main/java/com/vaadin/flow/theme/material/Material.java"
curl -l -s $lumoFile > ./scripts/generator/results/Lumo.java
curl -l -s $materialFile > ./scripts/generator/results/Material.java

# remove @JsModule and @NpmPackage annotation and their import lines
perl -pi -e 's/.*(JsModule|NpmPackage).*\n//g' ./scripts/generator/results/Lumo.java ./scripts/generator/results/Material.java

# copy the theme files to hilla and hilla-react
mkdir -p ./packages/java/hilla-react/src/main/java/dev/hilla/theme
mkdir -p ./packages/java/hilla/src/main/java/dev/hilla/theme
cp scripts/generator/results/Lumo.java packages/java/hilla-react/src/main/java/dev/hilla/theme/Lumo.java
cp scripts/generator/results/Lumo.java packages/java/hilla/src/main/java/dev/hilla/theme/Lumo.java
cp scripts/generator/results/Material.java packages/java/hilla-react/src/main/java/dev/hilla/theme/Material.java
cp scripts/generator/results/Material.java packages/java/hilla/src/main/java/dev/hilla/theme/Material.java
