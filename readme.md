# GitHub Tarball

This is an example code for downloading GitHub repository `.tar.gz` archive from
the GitHub API (which provides ZIP and TAR archive downloads), decompressing it
using Node's native `zlib` module and parsing the resulting stream entries out.

## Configuring

Replace `userName` and `repositoryName` in the code prior to running it if you
wish to try this on your own repository.

## Running

`node .`

## Testing

No tests yet.

## Purpose

This repository exists as a mere proof of concept. I wanted to see if I can get
from pure Node (no NPM or ESM dependencies) to a fully cloned GitHub repository.
There are Git clients build in pure JavaScript (check out Isomorphic-Git), but I
wanted to see if it would be possible without using any dependencies at all.

## To-Do

### Decide how to handle files which do not contain their relative directory

Most files are okay and they come out with paths like `repo/file.ext`. However,
some files, probably files whose full relative path would exceed the 100 bytes
available for the file name in Tar, only have their file name and no path stored
in the archive. I think the safe and probably expected thing to do here is to
take the last known path entry and prepend its path to the file name. A reliable
way to detect these files is probably just whether their file name contains a
slash?

### Fix padding NUL byte detection at the end of the archive

Right now after each entry I check to see if the remaining bytes are all NUL. I
don't use a particularly efficient way of doing it either and even if I did this
is just plain wasteful. I don't have a better way to detect and throw away the
end-of-file padding, so this works for now, but it should be improved.
