/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
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
 * Mozilla Messaging, Inc..
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * */

/*jslint plusplus: false, indent: 2 */
/*global define: false, location: true, window: false, alert: false,
  document: false, setTimeout: false, localStorage: false */
"use strict";
dump("loading facebook.js\n");
define([ "require", "jquery", "jschannel", "../common"],

function (require,   $,       jschannel,   common) {

  var domain = "facebook.com";
  
  var characteristics = {
      type: 'facebook', // XXX - should be able to nuke this.

      features: {
        //TODO: remove direct when old UI is no longer in use,
        //or remove it from use.
        //direct: true,
        subject: false,
        counter: true,
        medium: true
      },
      shareTypes: [{
        type: 'wall',
        name: 'my wall'
      }, {
        type: 'groupWall',
        name: 'group wall',
        showTo: true,
        toLabel: 'type in the name of the group'
      }],
      textLimit: 420,
      serviceUrl: 'http://facebook.com',
      revokeUrl: 'http://www.facebook.com/editapps.php?v=allowed',
      signOutUrl: 'http://facebook.com',
      /***
      accountLink: function (account) {
        return 'http://www.facebook.com/profile.php?id=' + account.userid;
      },
      overlays: {
        'widgets/AccountPanel': 'widgets/AccountPanelFaceBook'
      }
      ***/
      auth: {
        type: "oauth",
        name: "facebook",
        displayName: "Facebook",
        calls: {
                  signatureMethod     : "HMAC-SHA1",
                  userAuthorizationURL: "https://graph.facebook.com/oauth/authorize",
                  accessTokenURL      : "https://graph.facebook.com/oauth/access_token"
                },
        key: "110796232295543",
        secret: "19fd15e594991fd88e05b3534403e5c8",
        params: {
            scope: "publish_stream,offline_access,user_groups",
            type: "user_agent",
            display: "popup"
            },
        completionURI: "http://www.oauthcallback.local/postauthorize",
        version: "2.0",
        tokenRx: "#access_token=([^&]*)"
      }
    };

  // Bind the OWA messages
  var chan = Channel.build({window: window.parent, origin: "*", scope: window.location.href});
  chan.bind("confirm", function(t, data) {
    dump("facebook channel.confirm with args: " + data + "!\n");
    data.domain = domain;
    common.send(t, data);
  });
  chan.bind("link.send", function(t, args) {
    dump("facebook link.send connection\n");
  });
  chan.bind("link.send.getCharacteristics", function(t, args) {
    dump("facebook link.send.getCharacteristics\n");
    // some if these need re-thinking.
    return characteristics;
  });
  chan.bind("link.send.getLogin", function(t, args) {
    dump("facebook link.send.getLogin\n");
    return common.getLogin(t, domain, characteristics);
  });
  chan.bind("link.send.logout", function(t, args) {
    dump("facebook link.send.logout\n");
    return common.logout(t, domain);
  });
});
