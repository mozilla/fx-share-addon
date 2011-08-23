ifeq ($(OS),Windows_NT)
BIN_DIR = Scripts
else
BIN_DIR = bin
endif

APPNAME = fx-share-addon
DEPS = github:addon-sdk,github:oauthorizer,github:openwebapps
PYTHON = python

GIT_DESCRIBE := `git describe --long`

ifeq ($(TOPSRCDIR),)
  export TOPSRCDIR = $(shell pwd)
endif
profile :=
ifneq ($(OWA_PROFILE),)
  profile := --profiledir="$(OWA_PROFILE)"
endif

deps      := $(TOPSRCDIR)/deps
addon_sdk := $(deps)/addon-sdk/bin
oauthorizer := $(TOPSRCDIR)/deps/oauthorizer
openwebapps := $(TOPSRCDIR)/deps/openwebapps/addons/jetpack

cfx_args :=  --pkgdir=$(TOPSRCDIR) $(profile) --package-path=$(oauthorizer) --package-path=$(openwebapps) --binary-args="-console -purgecaches"

xpi_name := ffshare.xpi

SLINK = ln -sf
ifneq ($(findstring MINGW,$(shell uname -s)),)
  SLINK = cp -r
  export NO_SYMLINK = 1
endif

all: xpi

xpi:    pull
	$(addon_sdk)/cfx xpi $(cfx_args)

pull:
	$(VIRTUALENV) --no-site-packages --distribute .
	$(PYTHON) build.py $(APPNAME) $(DEPS)

test:
	$(addon_sdk)/cfx test $(cfx_args)

run:
	$(addon_sdk)/cfx run $(cfx_args)	

.PHONY: xpi clean pull test run
