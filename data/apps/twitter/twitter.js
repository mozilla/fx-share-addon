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

    getProfile: function(t, oauthConfig) {
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
        t.complete(user);

        // initiate contact retreival now
        api.contacts({type: 'followers'});
        //api.contacts({type: 'following'});
      });
    },

    send: function(t, data) {
      //dump("send data is "+JSON.stringify(data)+"\n")
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);
      var oauthConfig = urec.oauth;
      var url, body;

      if (data.shareType == 'direct') {
          if (!data.to) {
            dump("addressee missing\n");
            return;
          }
          url = 'https://api.twitter.com/1/direct_messages/new.json'
          body = { user: data.to, text: data.message }
      } else
      if (data.shareType == 'public') {
          url = 'https://api.twitter.com/1/statuses/update.json'
          body = { status: data.message }
      } else {
        dump("SHARE DATA INSUFFICIENT!\n");
        return;
      }
      
      //dump("send ["+url+"] args "+JSON.stringify(body)+"\n");

      navigator.apps.oauth.call(oauthConfig, {
        method: "POST",
        action: url,
        parameters: body
      },function(json) {
        dump("got twitter send result "+JSON.stringify(json)+"\n");
      });      
    },
    
    _handleContacts: function(data, type) {
      var ckey = api.key+'.'+type;
      var strval = window.localStorage.getItem(ckey);
      var users = strval && JSON.parse(strval) || [];

      for (var u in data.users) {
        users.push(api.profileToPoco(data.users[u]))
      }
      
      window.localStorage.setItem(ckey, JSON.stringify(users));
      return users.length;      
    },

    contacts: function(options) {
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);

      var params = {
          cursor: options && options.cursor || -1,
          screen_name: urec.profile.username
      };
      var url = "https://api.twitter.com/1/statuses/followers.json";
      if (options.type == 'following') {
        url = "NOT YET IMPLEMENTED";
        return;
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

dump("app using scope "+window.location.href+"\n");
  // Bind the OWA messages
  var chan = Channel.build({window: window.parent, origin: "*", scope: window.location.href});
  chan.bind("link.send", function(t, args) {
    dump("got link.send connection\n");
    api.send(t, args);
  });
  chan.bind("link.send.getCharacteristics", function(t, args) {
    // some if these need re-thinking.
    dump("twitter link.send.getCharacteristics\n");
    return characteristics;
  });
  chan.bind("link.send.setAuthorization", function(t, args) {
    dump("twitter link.send.setAuthorization\n");
    api.getProfile(t, args);
    t.delayReturn(true);
    return null;
  });
  chan.bind("link.send.getLogin", function(t, args) {
    dump("twitter link.send.getLogin\n");
    return common.getLogin(t, domain, characteristics);
  });
  chan.bind("link.send.logout", function(t, args) {
    return common.logout(t, domain);
  });
});
