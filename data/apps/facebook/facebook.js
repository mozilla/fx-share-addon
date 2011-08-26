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

  var domain = "facebook.com";

  var characteristics = {
      type: 'facebook', // XXX - should be able to nuke this.

      shareTypes: [{
        type: 'wall',
        name: 'my wall',
        textLimit: 420,
        medium: true,
        picture: true, // url to an image
        image: false, // base64 of image data
        title: true,
        caption: true,
        description: true
      }, {
        type: 'friendsWall',
        name: 'friends wall',
        textLimit: 420,
        toLabel: 'type in the name of the person you want to write to',
        medium: true,
        picture: true, // url to an image
        image: false, // base64 of image data
        title: true,
        caption: true,
        description: true
      }, {
        type: 'groupWall',
        name: 'group wall',
        textLimit: 420,
        toLabel: 'type in the name of the group',
        medium: true,
        picture: true, // url to an image
        image: false, // base64 of image data
        title: true,
        caption: true,
        description: true
      }],
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
                  userAuthorizationURL: "https://www.facebook.com/dialog/oauth",
                  accessTokenURL      : ""
                },
        key: "110796232295543",
        secret: "",
        params: {
            scope: "publish_stream,offline_access,user_groups",
            response_type: "token"
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

      // We only support exact displayName matching, and this is the key in
      // our collection.
      if (allCollection[recipstr]) {
        return allCollection[recipstr];
      }
      throw "invalid recipient '" + recipstr + "'";
    },

    getProfile: function(oauthConfig, cb, cberr) {
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
        // nuke the existing contacts before returning so we don't have a race
        // which allows a different user's contacts to be returned.
        // XXX - this whole "what user are the contacts for" needs thought...
        window.localStorage.removeItem(api.key+'.groups');
        window.localStorage.removeItem(api.key+'.friends');

        cb(user);

        // initiate contact retreival now
        api.contacts({type: 'groups'});
        api.contacts({type: 'friends'});

        } catch(e) {
          dump(e+"\n");
          cberr(e);
        }
      });
    },

    send: function(data, cb, cberr) {
      //dump("send data is "+JSON.stringify(data)+"\n")
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);
      var oauthConfig = urec.oauth;
      var url;
      var to = data.to || [];

      if (data.shareType === 'groupWall') {
        if (to.length === 0 || !to[0]) {
          throw "wall name missing";
        }
        if (to.length != 1) {
          throw "can only post to a single wall";
        }
        var pocoGroup = api.resolveRecipient(to[0], 'groups');
        var userid = api.getDomainAccount(pocoGroup).userid;
        url = "https://graph.facebook.com/"+userid+"/feed";
      } else
      if (data.shareType === 'friendsWall') {
        if (to.length === 0 || !to[0]) {
          throw "wall name missing";
        }
        if (to.length != 1) {
          throw "can only post to a single wall";
        }
        var pocoGroup = api.resolveRecipient(to[0], 'friends');
        var userid = api.getDomainAccount(pocoGroup).userid;
        url = "https://graph.facebook.com/"+userid+"/feed";
      } else
      if (data.shareType === 'wall') {
        if (to.length !== 0) {
          throw "invalid recipient for wall posting";
        }
        url = "https://graph.facebook.com/me/feed"
      } else {
        throw "invalid shareType";
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

      navigator.apps.oauth.call(oauthConfig, {
        method: "POST",
        action: url,
        parameters: body
      },function(json) {
        dump("got facebook send result "+JSON.stringify(json)+"\n");
        if ('error' in json) {
            cberr("error", json)
        } else {
            cb(json)
        }
      });
    },

    _handleContacts: function(data, type) {
      var ckey = api.key+'.'+type;
      var strval = window.localStorage.getItem(ckey);
      var groups = strval && JSON.parse(strval) || {};
      var newContacts = data.data || [];
      // We store in a keyed object so we can easily re-fetch contacts and
      // not wind up with duplicates.  Something better than displayName
      // might be better, but currently we rely on displayName being unique
      // so the UI works correctly (as it currently deals exclusively with
      // displayName)

      for each (var contact in newContacts) {
        var displayName = contact.name;
        groups[displayName] = {
          'displayName': displayName,
          'type': type,
          'accounts': [{ userid: contact.id, username: null, 'domain': domain }]
        };
      }

      window.localStorage.setItem(ckey, JSON.stringify(groups));
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

  // Bind to OWA
  navigator.apps.services.registerHandler('link.send', 'init', function(args, cb) {
  });

  navigator.apps.services.registerHandler('link.send', 'confirm', function(args, cb, cberr) {
    api.send(args, cb, cberr);
  });

  navigator.apps.services.registerHandler('link.send', 'getCharacteristics', function(args, cb, cberr) {
    // some if these need re-thinking.
    cb(characteristics);
  });

  navigator.apps.services.registerHandler('link.send', 'getLogin', function(args, cb, cberr) {
    common.getLogin(domain, characteristics, cb, cberr);
  });

  navigator.apps.services.registerHandler('link.send', 'setAuthorization', function(args, cb, cberr) {
    api.getProfile(args, cb, cberr);
  });

  navigator.apps.services.registerHandler('link.send', 'logout', function(args, cb, cberr) {
    common.logout(domain, args, cb, cberr);
  });

  // Get a list of recipient names for a specific shareType.  Only returns
  // the names to avoid leaking full profile information for all our contacts
  // (some of whom may have profiles private to the rest of the world.)
  // A super-anal service who thinks even this is leaking too much is free to
  // return an empty list.
  // This means the onus then falls back on us to match these names back up
  // with our PoCo records so we can extract the userid.
  navigator.apps.services.registerHandler('link.send', 'getShareTypeRecipients', function(args, cb, cberr) {
    var type;
    // XXX - todo - handle 'force'
    if (args.force) {
      dump("XXX - TODO: facebook needs to implement 'force' support");
    }
    if (args.shareType === "wall") {
      cb([]); // no possible values.
      return;
    } else if (args.shareType === "groupWall") {
      type = "groups";
    } else if (args.shareType === "friendsWall") {
      type = "friends";
    } else {
      throw("invalid shareType " + args.shareType + "\n");
    }
    var ckey = api.key+'.'+type;
    var strval = window.localStorage.getItem(ckey);
    var byName = JSON.parse(strval);
    // convert back to a simple array of names to use for auto-complete.
    var result = [];
    for (var displayName in byName) {
      result.push(displayName);
    }
    cb(result);
  });

  // Validate a list of strings which are intended to be recipient names.
  // The names possibly came back from getShareTypeRecipients() or were typed.
  // Returns a string (but that string would resolve to itself - ie, passing
  // 'Display Name' would resolve to @username, while @username always
  // resolves to @username.)
  // A super-anal service who thinks any resolution at all is leaking too much
  // into is free to return exactly the names which were passed in (then fail
  // at send time if appropriate)
  navigator.apps.services.registerHandler('link.send', 'resolveRecipients', function(args, cb, cberr) {
    var type;
    if (args.shareType === "groupWall") {
      type = "groups";
    } else
    if (args.shareType === "friendsWall") {
      type = "friends";
    } else {
      throw("invalid shareType " + args.shareType + "\n");
    }
    var results = []
    args.names.forEach(
      function(displayName) {
        try {
          api.resolveRecipient(displayName, type);
          results.push({result: displayName});
        } catch (e) {
          results.push({error: e.toString()});
        }
      }
    );
    cb(results);
  });

  // Tell OWA we are now ready to be invoked.
  navigator.apps.services.ready();
});
