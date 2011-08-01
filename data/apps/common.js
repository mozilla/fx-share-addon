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

define([ "require", "jquery"],
function (require,   $) {

  var common = function() {
    
  };
  common.prototype = {
    send: function(data, cb, cberr) {
      // first we need to "graft" the account data with the send data.
      var key = "ff-share-" + data.domain;
      var strval = window.localStorage.getItem(key);
      if (strval) {
        data.account = strval;
      }
      // Do the send!
      $.ajax('/api/send', {
        type: 'POST',
        domain: data.domain,
        data: data,
        dataType: 'json',
        success: function (json, textStatus, jqXHR) {
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
            cb(json);
          }
        },
        error: function (xhr, textStatus, err) {
          cberr("http_error", xhr.status);
        }
      });
    },

    getLogin: function(domain, config, cb, cberr) {
dump("getLogin called for "+domain+"\n");
      var key = "ff-share-" + domain;
      var strval = window.localStorage.getItem(key);
      var result = {};
      try {
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
        } else
        if (config.auth) {
          result.auth = config.auth;
        }
      } catch(e) {
        dump("common.getLogin error "+e+"\n");
        // some error, logout
        window.localStorage.removeItem(key);
        cberr(e);
        return;
      }
      cb(result);
    },

    logout: function(domain, args, cb, cberr) {
      var key = "ff-share-" + domain;
      window.localStorage.removeItem(key);
      cb({status: "ok"});
    }
  }

  return new common();
});
