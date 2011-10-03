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

define([ "require", "../common"],

function (require,  common) {
  var domain = "yammer.com"
  var parameters = {
      domain: "yammer.com",
      name: "yammer",
      displayName: "yammer",
      features: {
        title: true,
        description: true,
        picture: true
      },
      shareTypes: [{
        type: 'public',
        name: 'Public timeline'
      }, {
        type: 'direct',
        name: 'Direct Message',
        toLabel: 'type in name of recipient'
      }],
      constraints: {
        textLimit: 140,
        editableURLInMessage: true,
        shortURLLength: 20
      },
      auth: {
        type: "oauth",
        name: "yammer",
        displayName: "yammer",
        calls: {
                  signatureMethod     : "HMAC-SHA1",
                  requestTokenURL     : "https://www.yammer.com/oauth/request_token",
                  userAuthorizationURL: "https://www.yammer.com/oauth/authorize",
                  accessTokenURL      : "https://www.yammer.com/oauth/access_token"
                },
        key: "JDshwzM9ANfczUn2WFivjA",
        secret: "JGaOLPSutH9SZhoHn6yQ9YBHiI3cz1sOA88A1A8k4s",
        params: null,
        completionURI: "http://oauthcallback.local/access.xhtml",
        version: "1.0",
        tokenRx: "oauth_verifier=([^&]*)",
        deniedRx: "denied=([^&]*)"
      }
    };


  // Used to be sure to clear out any localStorage values.
  // Add to it if any new localStorage items are added.
  function clearStorage(activity, credentials) {
    var storage = window.localStorage;

    //This takes care of api.key localStorage
    common.logout(domain, activity, credentials);

    storage.removeItem(api.contacts_key);
  }

  var api = {
    key: "ff-share-" + domain,
    contacts_key: "ff-share-" + domain + ".contacts",

    profileToPoco: function(profile) {
      var poco = {
          name: profile.name,
          displayName: profile.full_name,
      }
      if (profile.web_url)
          poco['urls'] = [{"primary": false, "value": profile.web_url}]
      if (profile.mugshot_url)
          poco['photos'] = [{'type': 'profile',
                             "value": profile.mugshot_url}]

      poco['accounts'] = [{'domain': 'yammer.com',
                           'userid': profile.id,
                           'username': profile.name}]

      return poco
    },

    // Given a PoCo record, return the 'account' element for my domain.
    // Returns null if no such acct, throws if more than 1 such acct.
    getDomainAccount: function(poco) {
      var result = null;
      if (poco.accounts) {
        poco.accounts.forEach(function(acct) {
          if (acct.domain === domain) {
            if (result) {
              throw "malformed poco record - multiple '" + domain + "' accounts";
            }
            result = acct;
          }
        });
      }
      return result;
    },

    // Given a recipient name string, find a matching PoCo record guaranteed
    // to have an account identitifier for our domain.
    // Throws on error.
    resolveRecipient: function(recipstr) {
      var strval = window.localStorage.getItem(api.contacts_key);
      var allCollection = strval ? JSON.parse(strval) : {};

      // first check if it is a screen name already a key into the collection.
      if (allCollection[recipstr]) {
        return allCollection[recipstr];
      }
      // not there - see if a displayName
      for each (var check in allCollection) {
        if (check.displayName === recipstr) {
          return check;
        }
      }
      throw "invalid recipient '" + recipstr + "'";
    },

    getProfile: function(activity, credentials) {
      var oauthConfig = activity.data;
      // guess how I guessed the url for this call!
      navigator.mozApps.services.oauth.call(oauthConfig, {
        method: "GET",
        action: "https://www.yammer.com/api/v1/users/current.json",
        parameters: {}
      },function(json) {
        var me = api.profileToPoco(json);
        var user = {
          profile: me,
          oauth: oauthConfig
        }
        window.localStorage.setItem(api.key, JSON.stringify(user));
        // nuke the existing contacts before returning so we don't have a race
        // which allows a different user's contacts to be returned.
        // XXX - this whole "what user are the contacts for" needs thought...
        window.localStorage.removeItem(api.contacts_key);
        activity.postResult(user);

        // initiate contact retreival now
        api.contacts();
      });
    },

    send: function(activity, credentials) {
      //dump("send data is "+JSON.stringify(activity.data)+"\n")
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);
      var oauthConfig = urec.oauth;
      var url, body = {};
      var data = activity.data;
      var to = data.to || [];

      if (data.shareType == 'direct') {
        if (to.length === 0) {
          throw "direct message recipient missing";
        }
        if (to.length != 1) {
          throw "can only send to a single recipient";
        }
        var poco = api.resolveRecipient(to[0]);
        var userid = api.getDomainAccount(poco).userid;
        body = { direct_to_id: api.getDomainAccount(poco).userid };
      } else
      if (data.shareType != 'public') {
        throw "invalid shareType";
      }

      // f1_names: yammer
      var map = {
        'message': 'body',
        'link': 'og_url',
        'title': 'og_title',
        'description': 'og_description',
        'picture': 'og_image'
      };
      for (var n in map) {
        if (data[n])
          body[map[n]] = data[n];
      }
      dump("send args "+JSON.stringify(body)+"\n");

      navigator.mozApps.services.oauth.call(oauthConfig, {
        method: "POST",
        action: 'https://www.yammer.com/api/v1/messages.json',
        parameters: body
      },function(json) {
        dump("message response "+JSON.stringify(json)+"\n");
        if ('error' in json) {
            activity.postException({code:"error", message:json});
        } else {
            activity.postResult(json)
        }
      });
    },

    _handleContacts: function(data) {
      var strval = window.localStorage.getItem(api.contacts_key);
      var users = strval && JSON.parse(strval) || {};
      // We store in a keyed object so we can easily re-fetch contacts and
      // not wind up with duplicates.  Keyed by screen_name.
      data.forEach(function(user) {
        dump("adding user "+user.name+"\n");
        users[user.name] = api.profileToPoco(user);
      });
      window.localStorage.setItem(api.contacts_key, JSON.stringify(users));
    },

    contacts: function(options) {
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);

      var params = {
          page: options && options.cursor || 0,
      };

      var oauthConfig = urec.oauth;
      this._pagedContacts(params, oauthConfig);
    },

    _pagedContacts: function(params, oauthConfig) {
      navigator.mozApps.services.oauth.call(oauthConfig, {
        method: "GET",
        action: "https://www.yammer.com/api/v1/users.json",
        parameters: params
      },function(json) {
        api._handleContacts(json)
        if (json.length > 0) {
          params.page++;
          setTimeout(api._pagedContacts, 0, params, oauthConfig);
        }
      });
    }
  }

  // Bind the OWA messages
  navigator.mozApps.services.registerHandler('link.send', 'confirm', function(activity, credentials) {
    api.send(activity, credentials);
  });

  navigator.mozApps.services.registerHandler('link.send', 'getLogin', function(activity, credentials) {
    common.getLogin(domain, activity, credentials);
  });

  navigator.mozApps.services.registerHandler('link.send', 'setAuthorization', function(activity, credentials) {
    api.getProfile(activity, credentials);
  });

  navigator.mozApps.services.registerHandler('link.send', 'logout', function(activity, credentials) {
    clearStorage(activity, credentials);
  });

  // Get a list of recipient names for a specific shareType.  Only returns
  // the names to avoid leaking full profile information for all our contacts
  // (some of whom may have profiles private to the rest of the world.)
  // A super-anal service who thinks even this is leaking too much is free to
  // return an empty list.
  // This means the onus then falls back on us to match these names back up
  // with our PoCo records so we can extract the userid.
  navigator.mozApps.services.registerHandler('link.send', 'getShareTypeRecipients', function(activity, credentials) {
    var type;
    var args = activity.data;
    // XXX - todo - handle 'force'
    if (args.force) {
      dump("XXX - TODO: yammer needs to implement 'force' support");
    }
    if (args.shareType === "public") {
      activity.postResult([]); // no possible values.
      return;
    } else if (args.shareType === "direct") {
    } else {
      throw("invalid shareType " + args.shareType + "\n");
    }
    var strval = window.localStorage.getItem(api.contacts_key);
    var byName = JSON.parse(strval);
    // convert back to a simple array of names to use for auto-complete.
    var result = [];
    for (var name in byName) { // name is the screen_name
      var poco = byName[name];
      result.push(poco.displayName);
      result.push(name);
    }
    activity.postResult(result);
  });

  // Validate a list of strings which are intended to be recipient names.
  // The names possibly came back from getShareTypeRecipients() or were typed.
  // Returns a string (but that string would resolve to itself - ie, passing
  // 'Display Name' would resolve to @username, while @username always
  // resolves to @username.)
  // A super-anal service who thinks any resolution at all is leaking too much
  // into is free to return exactly the names which were passed in (then fail
  // at send time if appropriate)
  navigator.mozApps.services.registerHandler('link.send', 'resolveRecipients', function(activity, credentials) {
    var type;
    var args = activity.data;
    if (args.shareType === "public") {
      if (args.names && args.names.length) {
        throw("invalid call, public shares do not have recipients\n");
      }
      activity.postResult([]);
      return;
    }
    if (args.shareType === "direct") {
    } else {
      throw("invalid shareType " + args.shareType + "\n");
    }
    // XXX - should we just check for @username and return that without
    // checking our current list of followers?
    var results = [];
    args.names.forEach(
      function(recipstr) {
        try {
          var poco = api.resolveRecipient(recipstr)
          results.push({result: api.getDomainAccount(poco).username});
        } catch (e) {
          results.push({error: e.toString()});
        }
      }, this
    );
    activity.postResult(results);
  });


  navigator.mozApps.services.registerHandler('link.send', 'getParameters', function(activity, credentials) {
    // This is currently slightly confused - it is both link.send parameters and auth parameters.
    activity.postResult(parameters);
  });

  navigator.mozApps.services.registerHandler('link.send', 'getCredentials', function(activity, credentials) {
    common.getLogin(activity, credentials);
  });

  navigator.mozApps.services.registerHandler('link.send', 'validateCredentials', function(activity, credentials) {
  });

  navigator.mozApps.services.registerHandler('link.send', 'clearCredentials', function(activity, credentials) {
    clearStorage(activity, credentials);
  });

  // Tell OWA we are now ready to be invoked.
  navigator.mozApps.services.ready();
});
