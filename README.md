The branch you are looking at is an effort towards getting Firefox Share working
with the [Open Web Apps](https://apps.mozillalabs.com/) infrastructure.

PreRequisite
===============

* Firefox
* Python
* Git
* make

Getting setup
=====================

To pull and run fx-share addon:
  
    git clone https://github.com/mozilla/fx-share-addon
    cd fx-share-addon
    make pull
    make run
  
You can build an xpi:

    make xpi
  
You can run the tests:

    make test
  

If you want to run (using make run) in a specific profile:

    OWA_PROFILE=/path/to/firefox/profile make run
  
Tests cannot be run in a specific profile.


Prepare your firefox profile
-----------------------------

You probably want a test firefox profile so open up the [Profile Manager](http://kb.mozillazine.org/Profile_manager).

In the Mac:

    /Applications/Firefox.app/Contents/MacOS/firefox -ProfileManager

On Windows:

    firefox.exe -P

In the profile manager, create a profile with the name `fxsharetest`, then exit the profile manager.
