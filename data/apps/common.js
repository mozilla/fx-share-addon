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

define([ "require", "jquery", "rdapi",
         "jquery-ui-1.8.6.custom.min"],
function (require,   $,       rdapi) {

  var common = function() {
    
  };
  common.prototype = {
    send: function(t, data) {
      t.delayReturn(true); // we finish in the async callback.
      // first we need to "graft" the account data with the send data.
      var key = "ff-share-" + data.domain;
      var strval = window.localStorage.getItem(key);
      if (strval) {
        data.account = strval;
      }
      // Do the send!
      rdapi('send', {
        type: 'POST',
        domain: data.domain,
        data: data,
        success: function (json) {
          if (json.error && json.error.status) {
            var code = json.error.status;
            // XXX need to find out what error codes everyone uses
            // oauth+smtp will return a 535 on authentication failure
            if (code ===  401 || code === 535) {
              t.error("authentication");
            } else if (json.error.code === 'Client.HumanVerificationRequired') {
              t.error("captcha", [json.error.detail, null])
            } else if (json.error.code === 'Client.WrongInput') {
              t.error("captcha", [json.error.detail, json.error])
            } else {
              t.error("error", json.error.message)
            }
          } else if (json.error) {
            t.error("error", json.error.message)
          } else {
            // it worked!
            t.complete(json);
          }
        },
        error: function (xhr, textStatus, err) {
          t.error("http_error", xhr.status);
        }
      });
    },

    getLogin: function(t, domain) {
      var key = "ff-share-" + domain;
      var strval = window.localStorage.getItem(key);
      var result = {};
      if (strval) {
        var raw = JSON.parse(strval);
        // Turn the nested object into a flat one with profile and info all in one,
        // as required by the OWA APIs.
        var acct = raw.profile.accounts[0];
        var retUser = {};
        for (var attr in raw.profile) {
          if (raw.profile.hasOwnProperty(attr)) retUser[attr] = raw.profile[attr];
        }
        for (var attr in acct) {
          if (acct.hasOwnProperty(attr)) retUser[attr] = acct[attr];
        }
        result.user = retUser;
      } else {
        var url = '/dev/1/auth.html?domain=' + encodeURIComponent(domain);
        result.login = {dialog: url};
      }
      return result;
    },

    logout: function(t, domain) {
      var key = "ff-share-" + domain;
      window.localStorage.removeItem(key);
    }
  }

  return new common();
});
