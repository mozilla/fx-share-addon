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

define([ "require", "jquery", "jschannel", "../common"],

function (require,   $,       jschannel,   common) {
dump("TWITTER LOADING\n");
  var domain = "twitter.com"
  var characteristics = {
      type: 'twitter', // XXX - should be able to nuke this.

      features: {
        //TODO: remove direct when old UI is no longer in use,
        //or remove it from use.
        direct: true,
        subject: false,
        counter: true
      },
      shareTypes: [{
        type: 'public',
        name: 'Public timeline'
      }, {
        type: 'direct',
        name: 'Direct Message',
        showTo: true,
        toLabel: 'type in name of recipient'
      }],
      textLimit: 140,
      shorten: true,
      /***
      serviceUrl: 'http://twitter.com',
      revokeUrl: 'http://twitter.com/settings/connections',
      signOutUrl: 'http://twitter.com/logout',
      accountLink: function (account) {
        return 'http://twitter.com/' + account.username;
      },
      forceLogin: {
        name: 'force_login',
        value: true
      },
      overlays: {
        'Contacts': 'ContactsTwitter',
        'widgets/AccountPanel': 'widgets/AccountPanelTwitter'
      }
      ***/
      auth: {
        type: "dialog",
        url: 'http://localhost:5000/dev/1/auth.html?domain=' + encodeURIComponent(domain)
      }
      
    };
dump("app using scope "+window.location.href+"\n");
  // Bind the OWA messages
  var chan = Channel.build({window: window.parent, origin: "*", scope: window.location.href});
  chan.bind("confirm", function(t, data) {
    dump("channel.confirm with args: " + data + "!\n");
    data.domain = domain;
    common.send(t, data);
  });
  chan.bind("link.send", function(t, args) {
    dump("got link.send connection\n");
  });
  chan.bind("link.send.getCharacteristics", function(t, args) {
    // some if these need re-thinking.
    dump("twitter link.send.getCharacteristics\n");
    return characteristics;
  });
  chan.bind("link.send.getLogin", function(t, args) {
    dump("twitter link.send.getLogin\n");
    return common.getLogin(t, domain, characteristics);
  });
  chan.bind("link.send.logout", function(t, args) {
    return common.logout(t, domain);
  });
});
