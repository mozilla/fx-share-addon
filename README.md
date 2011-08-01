This repo contains the revised code originally meant for landing into fx5.  It has been reverted to a restartless addon but based on work from
https://hg.mozilla.org/users/pweitershausen_mozilla.com/fx-share/

The branch you are looking at is an effort towards getting Firefox Share working with the [Open Web Apps](https://apps.mozillalabs.com/) infrastructure.

Getting setup
=====================

These are your setup instructions, in the end your directory structure should look something like this:

    $PARENT/
           fx-share-addon
           oauthorizer
           openwebapps
           jetpack


Prepare your firefox profile
-----------------------------

You probably want a test firefox profile so open up the [Profile Manager](http://kb.mozillazine.org/Profile_manager).

In the Mac:

    /Applications/Firefox.app/Contents/MacOS/firefox -ProfileManager

On Windows:

    firefox.exe -P

In the profile manager, create a profile with the name `fxsharetest`, then exit the profile manager.

Install the [oauthorizer](https://github.com/mozilla/oauthorizer) add-on
------------------------------

This add-on is required to drive all OAuth systems inside the browser until those systems switch to using Open Web Apps.

Be sure to install it into the profile you will be working with.  e.g. `fxsharetest`

    git clone https://github.com/mozilla/oauthorizer
    cd oauthorizer
    echo `pwd` > /path/to/firefox/profile.fxsharetest/extensions/oauthorizer@mozillamessaging.com

Install the [Open Web Apps](https://github.com/mozilla/openwebapps) add-on
--------------------------------

In another directory, create a clone of the [Open Web Apps - mhammond fork](https://github.com/mhammond/openwebapps) add-on

    git clone https://github.com/mhammond/openwebapps

Switch to a `mediator` branch

    cd openwebapps
    git checkout origin/mediator


Install and setup the [Jetpack SDK](https://github.com/mozilla/jetpack)
------------------

Install the jetpack SDK in another directory

    git clone https://github.com/mozilla/jetpack

Activate the SDK

    cd jetpack
    source bin/activate

Run Firefox!
-------

From the `$PARENT` directory use the following command:

    cfx run --pkgdir=fx-share-addon \
        --package-path=openwebapps/addons/jetpack \
        --profiledir=/path/to/firefox/profile.fxsharetest \
        --binary-args=-console

_Note_:

`--pkgdir` points to the root directory of this `fx-share-addon` (i.e. the directory holding this README)

`--package-path` is the path to the `jetpack/addons` directory inside the [Open Web Apps - mhammond fork](https://github.com/mhammond/openwebapps) directory

`--profiledir` points to your Firefox `fxsharetest` profile  or other development profile where you installed [oauthorizer](https://github.com/mozilla/oauthorizer)
  _You can't use the 'temp' profile facility in Jetpack as the oauthorizer add-on needs to be installed and preferences need to be changed_

`--binary-args` are optional but you may want to add them - eg, `-console`, `-purgecaches`, `-chromebug` etc.
