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
        type: "oauth",
        name: "twitter",
        displayName: "Twitter",
        calls: {
                  signatureMethod     : "HMAC-SHA1",
                  requestTokenURL     : "https://twitter.com/oauth/request_token",
                  userAuthorizationURL: "https://twitter.com/oauth/authorize",
                  accessTokenURL      : "https://twitter.com/oauth/access_token"
                },
        key: "lppkBgcpuhe2TKZIRVoQg",
        secret: "M6hwPkgEyqxkDz583LFYAv5dTVg1AsKIXHFPiIFhsM",
        params: null,
        completionURI: "http://oauthcallback.local/access.xhtml",
        version: "1.0",
        tokenRx: "oauth_verifier=([^&]*)"
      }
      
    };

  var api = {
    key: "ff-share-" + domain,

    profileToPoco: function(profile) {
      var poco = {
          displayName: profile.name || profile.screen_name
      }
      if (profile.url)
          poco['urls'] = [{"primary": false, "value": profile.url}]
      if (profile.profile_image_url)
          poco['photos'] = [{'type': 'profile',
                             "value": profile.profile_image_url}]
      if (profile.created_at)
          poco['published'] = profile.created_at
  
      poco['accounts'] = [{'domain': 'twitter.com',
                           'userid': profile.id,
                           'username': profile.screen_name}]
  
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
    resolveRecipient: function(recipstr, type) {
      var ckey = api.key+'.'+type;
      var strval = window.localStorage.getItem(ckey);
      var allCollection = strval ? JSON.parse(strval) : {};

      // first check if it is a screen name already a key into the collection.
      if (recipstr.indexOf('@') === 0) {
        var sn = recipstr.substr(1);
        if (allCollection[sn]) {
          return allCollection[sn];
        }
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
      navigator.apps.oauth.call(oauthConfig, {
        method: "GET",
        action: "https://api.twitter.com/1/account/verify_credentials.json",
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
        window.localStorage.removeItem(api.key+'.followers');
        window.localStorage.removeItem(api.key+'.following');
        activity.postResult(user);

        // initiate contact retreival now
        api.contacts({type: 'followers'});
        //api.contacts({type: 'following'});
      });
    },

    send: function(activity, credentials) {
      //dump("send data is "+JSON.stringify(data)+"\n")
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);
      var oauthConfig = urec.oauth;
      var url, body;
      var data = activity.data;
      var to = data.to || [];

      if (data.shareType == 'direct') {
        if (to.length === 0) {
          throw "direct message recipient missing";
        }
        if (to.length != 1) {
          throw "can only send to a single recipient";
        }
        var poco = api.resolveRecipient(to[0], "followers")
        var userid = api.getDomainAccount(poco).userid;
        url = 'https://api.twitter.com/1/direct_messages/new.json';
        body = { user: api.getDomainAccount(poco).userid, text: data.message };
      } else
      if (data.shareType == 'public') {
          url = 'https://api.twitter.com/1/statuses/update.json'
          body = { status: data.message }
      } else {
        throw "invalid shareType";
      }
      
      //dump("send ["+url+"] args "+JSON.stringify(body)+"\n");

      navigator.apps.oauth.call(oauthConfig, {
        method: "POST",
        action: url,
        parameters: body
      },function(json) {
        dump("got twitter send result "+JSON.stringify(json)+"\n");
        if ('error' in json) {
            activity.postException({code:"error", message:json});
        } else {
            activity.postResult(json)
        }
      });      
    },
    
    _handleContacts: function(data, type) {
      var ckey = api.key+'.'+type;
      var strval = window.localStorage.getItem(ckey);
      var users = strval && JSON.parse(strval) || {};
      // We store in a keyed object so we can easily re-fetch contacts and
      // not wind up with duplicates.  Keyed by screen_name.
      data.users.forEach(function(user) {
        users[user.screen_name] = api.profileToPoco(user);
      });
      window.localStorage.setItem(ckey, JSON.stringify(users));
    },

    contacts: function(options) {
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);

      var params = {
          cursor: options && options.cursor || -1,
          screen_name: urec.profile.username,
          type: options.type
      };
      var url = "https://api.twitter.com/1/statuses/followers.json";
      if (options.type == 'following') {
        throw("NOT YET IMPLEMENTED");
      }

      var oauthConfig = urec.oauth;
      this._pagedContacts(url, params, oauthConfig);
    },

    _pagedContacts: function(url, params, oauthConfig) {
      navigator.apps.oauth.call(oauthConfig, {
        method: "GET",
        action: url,
        parameters: params
      },function(json) {
        api._handleContacts(json, params.type)
        if (json.next_cursor) {
          params.cursor = json.next_cursor;
          setTimeout(api._pagedContacts, 0, url, params, oauthConfig);
        }
      }); 
    }
  }

  // Bind the OWA messages
  navigator.apps.services.registerHandler('link.send', 'confirm', function(activity, credentials) {
    api.send(activity, credentials);
  });

  navigator.apps.services.registerHandler('link.send', 'getCharacteristics', function(activity, credentials) {
    // some if these need re-thinking.
    activity.postResult(characteristics);
  });

  navigator.apps.services.registerHandler('link.send', 'getLogin', function(activity, credentials) {
    common.getLogin(domain, activity, credentials);
  });

  navigator.apps.services.registerHandler('link.send', 'setAuthorization', function(activity, credentials) {
    api.getProfile(activity, credentials);
  });

  navigator.apps.services.registerHandler('link.send', 'logout', function(activity, credentials) {
    common.logout(domain, activity, credentials);
  });

  // Get a list of recipient names for a specific shareType.  Only returns
  // the names to avoid leaking full profile information for all our contacts
  // (some of whom may have profiles private to the rest of the world.)
  // A super-anal service who thinks even this is leaking too much is free to
  // return an empty list.
  // This means the onus then falls back on us to match these names back up
  // with our PoCo records so we can extract the userid.
  navigator.apps.services.registerHandler('link.send', 'getShareTypeRecipients', function(activity, credentials) {
    var type;
    var args = activity.data;
    // XXX - todo - handle 'force'
    if (args.force) {
      dump("XXX - TODO: twitter needs to implement 'force' support");
    }
    if (args.shareType === "public") {
      activity.postResult([]); // no possible values.
      return;
    } else if (args.shareType === "direct") {
      type = "followers";
    } else {
      throw("invalid shareType " + args.shareType + "\n");
    }
    var ckey = api.key+'.'+type;
    var strval = window.localStorage.getItem(ckey);
    var byName = JSON.parse(strval);
    // convert back to a simple array of names to use for auto-complete.
    var result = [];
    for (var name in byName) { // name is the screen_name
      var poco = byName[name];
      if (poco.displayName !== name) {
        result.push(poco.displayName);
      }
      result.push('@' + name);
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
  navigator.apps.services.registerHandler('link.send', 'resolveRecipients', function(activity, credentials) {
    var type;
    var args = activity.data;
    if (args.shareType === "direct") {
      type = "followers";
    } else {
      throw("invalid shareType " + args.shareType + "\n");
    }
    // XXX - should we just check for @username and return that without
    // checking our current list of followers?
    var results = [];
    args.names.forEach(
      function(recipstr) {
        try {
          var poco = api.resolveRecipient(recipstr, type)
          results.push({result: '@' + api.getDomainAccount(poco).username});
        } catch (e) {
          results.push({error: e.toString()});
        }
      }, this
    );
    activity.postResult(results);
  });

  // Tell OWA we are now ready to be invoked.
  navigator.apps.services.ready();
});
