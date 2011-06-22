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

const FFSHARE_EXT_ID = "ffshare@mozilla.org";
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://ffshare/modules/addonutils.js");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const SHARE_BUTTON_ID = 'share-button';

const EXPORTED_SYMBOLS = ["installOverlay", "installPrefsOverlay"];

function installPrefsOverlay(win) {
  let unloaders = [];
  let xulRuntime = Cc["@mozilla.org/xre/app-info;1"]
                     .getService(Ci.nsIXULRuntime);

  let document = win.document;

  // Load our stylesheet and register an unloader that removes it again.
  let pi;
  if (xulRuntime.OS === "WINNT") {
    pi = loadStylesheet(win, "resource://ffshare/chrome/skin/winstripe/preferences.css");
  } else
  if (xulRuntime.OS === "Darwin") {
    pi = loadStylesheet(win, "resource://ffshare/chrome/skin/pinstripe/preferences.css");
  } else  {
    pi = loadStylesheet(win, "resource://ffshare/chrome/skin/gnomestripe/preferences.css");
  }
  unloaders.push(function () {
    win.document.removeChild(pi);
  });

  // ********************************************************************
  // create our commandset for browser-set.inc
  //<prefpane id="paneShare" label="&paneShare.title;"
  //          src="chrome://browser/content/preferences/share.xul"/>

  let pane = document.createElementNS(NS_XUL, 'prefpane');
  let place = document.getElementById('paneSecurity').nextSibling;

  pane.setAttribute('id', 'paneShare');
  pane.setAttribute('label', getString("paneShare.title"));
  // cannot directly load a resource uri
  pane.setAttribute('src', "about:blank");
  place.parentNode.insertBefore(pane, place);
  place.parentNode.addPane(pane);
  pane.setAttribute('src', "resource://ffshare/chrome/content/preferences.xul");

  unloaders.push(function() {
      document.getElementById('BrowserPreferences').removeChild(
          document.getElementById('paneShare')
      );
  });

  return unloaders;
}

function installOverlay(win) {
  let unloaders = [];
  let Application = Cc["@mozilla.org/fuel/application;1"]
                      .getService(Ci.fuelIApplication);
  let xulRuntime = Cc["@mozilla.org/xre/app-info;1"]
                     .getService(Ci.nsIXULRuntime);

  let document = win.document;

  // Load our stylesheet and register an unloader that removes it again.
  dump("running on "+xulRuntime.OS+"\n");
  let pi;
  if (xulRuntime.OS === "WINNT") {
    pi = loadStylesheet(win, "resource://ffshare/chrome/skin/winstripe/share.css");
  } else
  if (xulRuntime.OS === "Darwin") {
    pi = loadStylesheet(win, "resource://ffshare/chrome/skin/pinstripe/share.css");
  } else  {
    pi = loadStylesheet(win, "resource://ffshare/chrome/skin/gnomestripe/share.css");
  }
  unloaders.push(function () {
    win.document.removeChild(pi);
  });
  
  // set some global prefs we need
  try {
    Services.prefs.getCharPref("services.share.shareURL");
  } catch(e) {
    Services.prefs.setCharPref("services.share.shareURL", "https://f1.mozillamessaging.com/share/panel/");
  }
  try {
    Services.prefs.getCharPref("services.share.settingsURL");
  } catch(e) {
    Services.prefs.setCharPref("services.share.settingsURL", "https://f1.mozillamessaging.com/share/settings/");
  }
  try {
    Services.prefs.getBoolPref("services.share.bookmarking");
  } catch(e) {
    Services.prefs.setBoolPref("services.share.bookmarking", true);
  }

  // ********************************************************************
  // create our commandset for browser-set.inc
  // <commandset id="mainCommandSet">
  // <command id="cmd_toggleSharePanel" oncommand="ffshare.togglePanel(event);"/>
  // </commandset>

  let command = document.createElementNS(NS_XUL, 'command');
  command.setAttribute('id', 'cmd_toggleSharePanel');
  command.setAttribute('oncommand', "ffshare.togglePanel(event);");
  document.getElementById('mainCommandSet').appendChild(command);

  unloaders.push(function() {
      document.getElementById('mainCommandSet').removeChild(
          document.getElementById('cmd_toggleSharePanel')
      );
  });

  // ********************************************************************
  // create our keyset for browser-set.inc
  // <keyset id="mainKeyset">
  // <key id="key_ffshare" keycode="VK_F1" command="cmd_toggleSharePanel"/>
  // </keyset>

  let key = document.createElementNS(NS_XUL, 'key');
  key.setAttribute('id', 'key_ffshare');
  key.setAttribute('command', 'cmd_toggleSharePanel');
  document.getElementById('mainKeyset').appendChild(key);
  unloaders.push(function() {
      document.getElementById('mainKeyset').removeChild(
          document.getElementById('key_ffshare')
      );
  });


  // ********************************************************************
  // create the context menu's
  // XXX do we still want context menus?

  let context = document.getElementById('contentAreaContextMenu');
  let place = document.getElementById('context-sendpage').nextSibling;

  let el = document.createElementNS(NS_XUL, 'menuseparator');
  el.setAttribute('id', 'context-ffshare-separator');
  context.insertBefore(el, place);

  el = document.createElementNS(NS_XUL, 'menuitem');
  el.setAttribute('id', 'context-ffshare');
  el.setAttribute('label', getString("sharePageCmd.label"));
  el.setAttribute('command', 'cmd_toggleSharePanel');
  context.insertBefore(el, place);

  place = document.getElementById('context-sep-selectall').nextSibling;

  el = document.createElementNS(NS_XUL, 'menuitem');
  el.setAttribute('id', 'context-selected-ffshare');
  el.setAttribute('label', getString("sharePageCmd.label"));
  el.setAttribute('command', 'cmd_toggleSharePanel');
  context.insertBefore(el, place);

  el = document.createElementNS(NS_XUL, 'menuseparator');
  el.setAttribute('id', 'context-selected-ffshare-separator');
  el.setAttribute('hidden', 'true');
  context.insertBefore(el, place);

  //document.getElementById('mainPopupSet').appendChild(popup);
  unloaders.push(function() {
      let context = document.getElementById('contentAreaContextMenu');
      context.removeChild(document.getElementById('context-ffshare'));
      context.removeChild(document.getElementById('context-ffshare-separator'));
      context.removeChild(document.getElementById('context-selected-ffshare-separator'));
      context.removeChild(document.getElementById('context-selected-ffshare'));
  });

  // ********************************************************************
  // create the share panel/doorhanger
  // <panel id="share-popup"
  //       type="arrow"
  //       level="parent">
  //  <browser id="share-browser"
  //           type="content"
  //           flex="1"
  //           src="about:blank"
  //           disablehistory="true"
  //           contextmenu="contentAreaContextMenu"
  //           class="ffshare-browser"/>
  // </panel>

  let panel = document.createElementNS(NS_XUL, 'panel');
  panel.setAttribute('id', 'share-popup');
  panel.setAttribute('type', 'arrow');
  panel.setAttribute('level', 'parent');

  let browser = document.createElementNS(NS_XUL, 'browser');
  browser.setAttribute('id', 'share-browser');
  browser.setAttribute('type', 'content');
  browser.setAttribute('flex', '1');
  browser.setAttribute('src', 'about:blank');
  browser.setAttribute('disablehistory', 'true');
  browser.setAttribute('contextmenu', 'contentAreaContextMenu');
  browser.setAttribute('class', 'ffshare-browser');
  panel.appendChild(browser);

  let popupset = document.getElementById('mainPopupSet');
  popupset.appendChild(panel);

  unloaders.push(function() {
      let popupset = document.getElementById('mainPopupSet');
      popupset.removeChild(document.getElementById('share-popup'));
  });


  // ********************************************************************
  // create the file menu item for browser-menubar.inc
  //<menu id="file-menu">
  //  <menupopup id="menu_FilePopup">
  //    ...
  //    <menuitem id="menu_sendLink" ...>
  //    <menuitem id="menu_sharePage"
  //              label="&sharePageCmd.label;"
  //              accesskey="&sharePageCmd.accesskey;"
  //              command="cmd_toggleSharePanel"/>
  
  let popup = document.getElementById('menu_FilePopup');
  let place = document.getElementById('menu_sendLink').nextSibling;

  menu = document.createElementNS(NS_XUL, 'menuitem');
  menu.setAttribute('id', 'menu_ffshare');
  menu.setAttribute('label', getString("sharePageCmd.label"));
  menu.setAttribute('accesskey', getString("sharePageCmd.accesskey"));
  menu.setAttribute('command', 'cmd_toggleSharePanel');

  popup.insertBefore(menu, place);

  unloaders.push(function() {
      let popup = document.getElementById('menu_FilePopup');
      popup.removeChild(document.getElementById('menu_ffshare'));
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
  //          onclick="ffshare.togglePanel(event);"/>

  let button = document.createElementNS(NS_XUL, "image");
  button.id = SHARE_BUTTON_ID;
  button.className = "urlbar-icon";
  button.setAttribute("onclick", "ffshare.togglePanel(event);");
  let urlbarIcons = document.getElementById("urlbar-icons");
  urlbarIcons.insertBefore(button, urlbarIcons.firstChild);
  unloaders.push(function() {
    urlbarIcons.removeChild(button);
  });

  return unloaders;
}
