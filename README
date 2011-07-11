This repo contains the revised code originally meant for landing into fx5.  It
has been reverted to a restartless addon but based on work from
https://hg.mozilla.org/users/pweitershausen_mozilla.com/fx-share/

The branch you are looking at is an effort towards getting fx-share working
in the Open Web Apps infrastructure.  This requires:

Setting up the addon:
=====================

Install the oauthorizer addon.
------------------------------

Until the webapps move to the primary domain providers responsibility, they will
be client side oauth driven.  The oauthorizer addon is currently being used to
quick-start the process.  Be sure to install it into the profile you will use
for use with owa and f1.

* git clone https://github.com/mozilla/oauthorizer
* echo /path/to/oauthorizer > /path/to/firefox/profile/extensions/oauthorizer@mozillamessaging.com

Install the Open Web Apps addon.
--------------------------------

* In some directory, clone a clone of the OpenWebApps addon - git@github.com:mhammond/openwebapps.git
* Switch to a 'mediator' branch - 'git checkout origin/mediator'

Prepare your firefox profile.
-----------------------------

* You probably want a test firefox profile.

Setup Jetpack SDK.
------------------

* Install the jetpack SDK - the gibhub clone is probably better.
* Apply the patch at https://bugzilla.mozilla.org/show_bug.cgi?id=665786
* Activate the SDK by executing 'source bin/activate'

Run it!
-------

* Execute the command:
  cfx run --pkgdir=path_to_fx_share_addon \
          --package-path=path_to_owa_addon_root/addons/jetpack \
          --profiledir=path_to_your_profile \
          --binary-args=-console

  Note:

  * path_to_fx_share_addon is the root directory of the share addon (ie, the
    directory holding this readme)

  * path_to_owa_addon_root is the path to the root of the OWA addon clone.

  * path_to_your_profile is the path to your Firefox dev profile (you can't
    use the 'temp' profile facility in Jetpack as the above preferences need
    to be adjusted before things will work.)

  * You may want additional --binary-args - eg, -console, -purgecaches,
    -chromebug etc.
