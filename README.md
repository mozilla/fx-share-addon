This repo contains the revised code originally meant for landing into fx5.  It
has been reverted to a restartless addon but based on work from
https://hg.mozilla.org/users/pweitershausen_mozilla.com/fx-share/

The branch you are looking at is an effort towards getting fx-share working
in the Open Web Apps infrastructure.  This requires:

Setting up the addon:
=====================

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

Until the webapps move to the primary domain providers responsibility, they will
be client side oauth driven.  The oauthorizer addon is currently being used to
quick-start the process.  Be sure to install it into the profile you will use
for use with owa and f1.

    git clone https://github.com/mozilla/oauthorizer
    cd oauthorizer
    echo `pwd` > /path/to/firefox/profile/extensions/oauthorizer@mozillamessaging.com

Install the [Open Web Apps](https://github.com/mozilla/openwebapps) add-on
--------------------------------

In another directory, create a clone of the [Open Web Apps](https://github.com/mozilla/openwebapps) add-on

    git clone git@github.com:mhammond/openwebapps.git

Switch to a `mediator` branch

    git checkout origin/mediator


Setup [Jetpack SDK](https://github.com/mozilla/jetpack)
------------------

Install the jetpack SDK in another directory

    git clone https://github.com/mozilla/jetpack

Apply the patch at [bug 665786](https://bugzilla.mozilla.org/show_bug.cgi?id=665786)

    wget "https://bug665786.bugzilla.mozilla.org/attachment.cgi?id=540617" -O jetpack-sdk.patch
    cd jetpack
    patch -p1 -i ../jetpack-sdk.patch

Activate the SDK

    source bin/activate

Run it!
-------

From `fx-share-addon` directory run the command:

    cfx run --pkgdir=path_to_fx_share_addon \
        --package-path=path_to_owa_addon_root/addons/jetpack \
        --profiledir=path_to_your_profile \
        --binary-args=-console

Note:

`path_to_fx_share_addon` is the root directory of the share addon (ie, the directory holding this readme)

`path_to_owa_addon_root` is the path to the root of the OWA addon clone.

`path_to_your_profile` is the path to your Firefox dev profile (you can't use the 'temp' profile facility in Jetpack as the above preferences need to be adjusted before things will work.)

You may want additional `--binary-args` - eg, `-console`, `-purgecaches`, `-chromebug` etc.
