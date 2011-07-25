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
        medium: true,
        picture: true, // url to an image
        image: false, // base64 of image data
        title: true,
        caption: true,
        description: true,
        privacy: true
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


  var api = {
    key: "ff-share-" + domain,

    profileToPoco: function(profile) {
      // pilfered from contacts addon
      var newPerson = {};
      if (profile.name) newPerson.displayName = profile.name;
      if (profile["first_name"]) {
        if (!newPerson.name ) newPerson.name={};
        newPerson.name.givenName = profile["first_name"];
      }
      if (profile["last_name"]) {
        if (!newPerson.name) newPerson.name={};
        newPerson.name.familyName = profile["last_name"];
      }
      if (profile.birthday) {
        newPerson.birthday = profile.birthday;
      }
      if (profile.about) {
        newPerson.notes = [{type:"About", value:profile.about}];
      }
      if (profile.website) {
        var websites = profile.website.split("\n");
        for each (var site in websites) {
          if (!newPerson.urls) newPerson.urls = [];
          
          if (site.length > 0) {
            if (site.indexOf("http://") != 0) {
              site = "http://" + site;
            }
            
            newPerson.urls.push({type:'url', value:site})
          }
        }
      }

      var username=null;
      if (profile.link) {
        if (!newPerson.urls) newPerson.urls = [];
        newPerson.urls.push({type:"facebook.com", value:profile.link});

        var lastIdx = profile.link.lastIndexOf("/");
        username = profile.link.slice(lastIdx+1);
        if (username.indexOf("profile.php?id=") == 0) username = username.slice(15);

        newPerson.accounts = [{domain:"facebook.com", username:username, userid:profile.id}];
      }
      newPerson.photos = [
        {type:"thumbnail", value:"https://graph.facebook.com/" + (username ? username : profile.id) + "/picture?type=square"},
        {type:"profile", value:"https://graph.facebook.com/" + (username ? username : profile.id) + "/picture?type=large"}
      ];
      return newPerson;
    },
    
    getProfile: function(t, oauthConfig) {
      dump("calling https://graph.facebook.com/me\n");
      navigator.apps.oauth.call(oauthConfig, {
        method: "GET",
        action: "https://graph.facebook.com/me",
        parameters: {}
      },function(json) {
        //dump("got facebook profile "+JSON.stringify(json)+"\n");
        try {
        var me = api.profileToPoco(json);
        var user = {
          profile: me,
          oauth: oauthConfig
        }
        window.localStorage.setItem(api.key, JSON.stringify(user));
        t.complete(user);

        // initiate contact retreival now
        api.contacts({type: 'groups'});
        api.contacts({type: 'friends'});

        } catch(e) {
          dump(e+"\n");
        }
      });
    },
    
    send: function(t, data) {
      //dump("send data is "+JSON.stringify(data)+"\n")
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);
      var oauthConfig = urec.oauth;
      var url;

      if (data.shareType == 'groupWall') {
          direct = options.get('to', None)
          if (!data.direct) {
            dump("addressee missing\n");
            return;
          }
          url = "https://graph.facebook.com/"+data.direct+"/feed"
      } else
      if (data.shareType == 'wall') {
          url = "https://graph.facebook.com/me/feed"
      } else {
        dump("SHARE DATA INSUFFICIENT!\n");
        return;
      }
      // map facebook: f1 data names
      // facebook docs https://developers.facebook.com/docs/reference/api/post/
      var map = {
        'message': 'message',
        'link': 'link',
        'title': 'name',
        'description': 'description',
        'picture': 'picture',
        'caption': 'caption',
        'source': 'source',
        'privacy': 'privacy'
      };
      var body = {};
      for (var n in map) {
        if (data[n])
          body[map[n]] = data[n];
      }
      dump("send ["+url+"] args "+JSON.stringify(body)+"\n");

      t.delayReturn(true);
      navigator.apps.oauth.call(oauthConfig, {
        method: "POST",
        action: url,
        parameters: body
      },function(json) {
        dump("got facebook send result "+JSON.stringify(json)+"\n");
        if ('error' in json) {
            t.error("error", json)
        } else {
            t.complete(json)
        }
      });
    },
    
    _handleContacts: function(data, type) {
      var ckey = api.key+'.'+type;
      var strval = window.localStorage.getItem(ckey);
      var groups = strval && JSON.parse(strval) || [];

      for (var g in data) {
        groups.push({
          'displayName': data[g].name,
          'type': type,
          'accounts': [{ userid: data[g].id, username: null, 'domain': domain }]
        })
      }
      
      window.localStorage.setItem(ckey, JSON.stringify(groups));
      return groups.length;
    },

    contacts: function(options) {
      var params = {
          offset: options && options.offset || 0,
          limit: options && options.limit || 50,
          type: options && options.type || 'groups'
      };
      var url = "https://graph.facebook.com/me/"+ params.type;

      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);
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
        if (json.paging && json.paging.next) {
          params.offset += params.limit;
          setTimeout(api._pagedContacts, 0, url, params, oauthConfig);
        }
      }); 
    }
  };

  // Bind the OWA messages
  var chan = Channel.build({window: window.parent, origin: "*", scope: window.location.href});
  chan.bind("link.send", function(t, args) {
    dump("facebook link.send connection\n");
    api.send(t, args);
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
  chan.bind("link.send.setAuthorization", function(t, args) {
    dump("facebook link.send.setAuthorization\n");
    api.getProfile(t, args);
    t.delayReturn(true);
    return null;
  });
  chan.bind("link.send.logout", function(t, args) {
    dump("facebook link.send.logout\n");
    return common.logout(t, domain);
  });
});
