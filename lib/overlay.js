/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Raindrop.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *	Anant Narayanan <anant@kix.in>
 *	Shane Caraveo <shanec@mozillamessaging.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const {Cc, Ci, Cm, Cu} = require("chrome");

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
let {Services} = tmp;

let {loadStylesheet, getString} = require("addonutils");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const SHARE_BUTTON_ID = 'share-button';

function installOverlay(win) {
  let unloaders = [];
  let Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
  let xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);

  let document = win.document;

  // Load our stylesheet and register an unloader that removes it again.
  console.log("running on ", xulRuntime.OS);
  let pi;
  if (xulRuntime.OS === "WINNT") {
    pi = loadStylesheet(win, "skin/winstripe/share.css");
  } else if (xulRuntime.OS === "Darwin") {
    pi = loadStylesheet(win, "skin/pinstripe/share.css");
  } else {
    pi = loadStylesheet(win, "skin/gnomestripe/share.css");
  }
  // BUG 647295 - can't unload this as by the time the unload function is called
  // win.document is undefined.  Does this really matter?
  /**
   unloaders.push(function () {
   win.document.removeChild(pi);
   });
   **/

  try {
    Services.prefs.getBoolPref("services.share.bookmarking");
  } catch (e) {
    Services.prefs.setBoolPref("services.share.bookmarking", true);
  }

  // ********************************************************************
  // create our commandset for browser-set.inc
  // <commandset id="mainCommandSet">
  // <command id="cmd_toggleSharePanel" oncommand="fxshare.togglePanel(event);"/>
  // </commandset>
  let command = document.createElementNS(NS_XUL, 'command');
  command.setAttribute('id', 'cmd_toggleSharePanel');
  command.setAttribute('oncommand', "fxshare.togglePanel(event);");
  document.getElementById('mainCommandSet').appendChild(command);

  unloaders.push(function() {
    document.getElementById('mainCommandSet').removeChild(
    document.getElementById('cmd_toggleSharePanel'));
  });

  // ********************************************************************
  // create our keyset for browser-set.inc
  // <keyset id="mainKeyset">
  // <key id="key_fxshare" keycode="VK_F1" command="cmd_toggleSharePanel"/>
  // </keyset>
  let key = document.createElementNS(NS_XUL, 'key');
  key.setAttribute('id', 'key_fxshare');
  key.setAttribute('keycode', 'VK_F1');
  key.setAttribute('command', 'cmd_toggleSharePanel');
  document.getElementById('mainKeyset').appendChild(key);
  unloaders.push(function() {
    document.getElementById('mainKeyset').removeChild(
    document.getElementById('key_fxshare'));
  });

  // ********************************************************************
  // create the app menu item for browser-appmenu.inc
  // <vbox id="appmenuPrimaryPane">
  //    <menuitem id="appmenu_sharePage"
  //              label="&sharePageCmd.label;"
  //              command="cmd_toggleSharePanel"/>
  let appmenu = document.getElementById('appmenuPrimaryPane');
  if (appmenu) {
    place = document.getElementById('appmenu_sendLink').nextSibling;

    menu = document.createElementNS(NS_XUL, 'menuitem');
    menu.setAttribute('id', 'appmenu_sharePage');
    menu.setAttribute('label', getString("sharePageCmd.label"));
    menu.setAttribute('command', 'cmd_toggleSharePanel');

    appmenu.insertBefore(menu, place);

    unloaders.push(function() {
      let appmenu = document.getElementById('appmenuPrimaryPane');
      appmenu.removeChild(document.getElementById('appmenu_sharePage'));
    });
  }

  // ********************************************************************
  // create the urlbar button from browser.xul
  // <hbox id="urlbar-icons">
  //   <image id="share-button"
  //          tooltiptext="&browserShareIcon.tooltip;"
  //          class="urlbar-icon"
  //          onclick="fxshare.togglePanel(event);"/>
  let button = document.createElementNS(NS_XUL, "image");
  button.id = SHARE_BUTTON_ID;
  button.className = "urlbar-icon";
  button.setAttribute("onclick", "fxshare.togglePanel(event);");
  button.setAttribute("tooltiptext", getString("sharePageCmd.tooltip"));
  let urlbarIcons = document.getElementById("urlbar-icons");
  urlbarIcons.insertBefore(button, urlbarIcons.firstChild);
  unloaders.push(function() {
    urlbarIcons.removeChild(button);
  });

  return unloaders;
}

exports.installOverlay = installOverlay;
