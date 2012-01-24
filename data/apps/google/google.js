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

define([ "require", "../common", "jquery", "jquery.tmpl"],

function (require,  common,      $) {
  var domain = "google.com"
  var parameters = {
      domain: "google.com",
      name: "gmail",
      displayName: "Gmail",
      features: {
        direct: true,
        subjectLabel: true,
        picture: true,
        description: true
      },
      shareTypes: [{
          type: 'email',
          name: 'direct',
          toLabel: 'type in name of recipient'
      }],
      constraints: {
      },
      auth: {
      type: "oauth",
      name: "google",
      displayName: "Google",
      calls: {
        signatureMethod     : "HMAC-SHA1",
        requestTokenURL     : "https://www.google.com/accounts/OAuthGetRequestToken",
        userAuthorizationURL: "https://www.google.com/accounts/OAuthAuthorizeToken",
        accessTokenURL      : "https://www.google.com/accounts/OAuthGetAccessToken",
        emailUrl: "https://mail.google.com/mail/b/%s/smtp/"
      },
      key: "anonymous",
      secret: "anonymous",
      params: {
        xoauth_displayname: "GMail for Firefox Share",
        scope: "https://mail.google.com/ http://www.google.com/m8/feeds/",
        response_type: "token"
        },
      completionURI: "http://www.oauthcallback.local/postauthorize",
      version: "1.0",
      tokenRx: "oauth_verifier=([^&]*)"
    }
  };

  // Used to be sure to clear out any localStorage values.
  // Add to it if any new localStorage items are added.
  function clearStorage(activity, credentials) {
    var storage = window.localStorage;

    //This takes care of api.key localStorage
    common.logout(domain, activity, credentials);

    storage.removeItem(api.key + '.email');
  }

  var api = {
    key: "ff-share-" + domain,

    _getNsPrefix: function(feed, url) {
      var ns;
      for (ns in feed) {
        if (feed[ns] == url) break;
      }
      if (ns)
        return ns.split('$')[1] + "$";
      return "";
    },

    /**
     * we receive the first page of the contacts reply, which will have the
     * id and some other basic details on who is logged in.  parse that out
     * and return a profile object.
     */
    profileToPoco: function(feed) {
      var poco = {
          displayName: feed.author[0].name.$t
      }
      poco['accounts'] = [{'domain': 'gmail.com',
                           'userid': feed.id.$t,
                           'username': feed.author[0].name.$t}]

      return poco
    },

    contactToPoco: function(contact, gd) {
      var emailNs = gd+"email";
      var poco = {
          displayName: contact.title.$t,
          emails: []
      }
      //dump("emails: "+JSON.stringify(contact[emailNs])+"\n");
      if (contact[emailNs]) {
        for (var e=0; e < contact[emailNs].length; e++) {
          poco.emails.push({
            'value': contact[emailNs][e].address,
            'type': contact[emailNs][e].label || contact[emailNs][e].rel.split('#')[1],
            'primary': contact[emailNs][e].primary
          });
        }
      }
      return poco;
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

    getProfile: function(activity, credentials) {
      var oauthConfig = activity.data;
      navigator.mozActivities.services.oauth.call(oauthConfig, {
        method: "GET",
        action: "https://www.google.com/m8/feeds/contacts/default/full",
        parameters: {alt:'json'}
      },function(json) {
        var me = api.profileToPoco(json.feed);
        var user = {
          profile: me,
          oauth: oauthConfig
        }
        window.localStorage.setItem(api.key, JSON.stringify(user));
        // nuke the existing contacts before returning so we don't have a race
        // which allows a different user's contacts to be returned.
        // XXX - this whole "what user are the contacts for" needs thought...
        try {
          window.localStorage.removeItem(api.key+'.email');
        } catch(e) {}
        activity.postResult(user);

        // handle the first page of contacts now
        api._handleContacts(json.feed, 'email', oauthConfig);
      });
    },

    _handleContacts: function(data, type, oauthConfig) {
      var prefix = api._getNsPrefix(data, "http://schemas.google.com/g/2005");
      var ckey = api.key+'.'+type;
      var strval = window.localStorage.getItem(ckey);
      var users = strval && JSON.parse(strval) || {};
      // We store in a keyed object so we can easily re-fetch contacts and
      // not wind up with duplicates.  Keyed by email adfress.
      data.entry.forEach(function(entry) {
        var poco = api.contactToPoco(entry, prefix);
        poco.emails.forEach(function (email) {
          users[email.value] = poco;
        });
      });
      window.localStorage.setItem(ckey, JSON.stringify(users));

      var os = api._getNsPrefix(data, "http://a9.com/-/spec/opensearchrss/1.0/");

      var params = {
        'max-results': 25,
        'start-index': parseInt(data[os+'startIndex'].$t) + parseInt(data[os+'itemsPerPage'].$t),
        'alt': 'json'
      }
      data.link.forEach(function(link) {
        if (link.rel == 'next') {
          window.setTimeout(api._pagedContacts, 0, link.href.split('?')[0], params, oauthConfig);
        }
      });
    },

    _pagedContacts: function(url, params, oauthConfig) {
      navigator.mozActivities.services.oauth.call(oauthConfig, {
        method: "GET",
        action: url,
        parameters: params
      },function(json) {
        api._handleContacts(json.feed, 'email', oauthConfig);
      });
    },

    send: function(activity, credentials) {
      var strval = window.localStorage.getItem(api.key);
      var urec = JSON.parse(strval);
      var oauthConfig = urec.oauth;
      dump("send data is "+JSON.stringify(activity.data)+"\n");
      //dump("oauthConfig is "+JSON.stringify(oauthConfig)+"\n");

  // XXX jquery.template is not working as I had hoped for the text template.
  // prepare templates
  var textTmpl = $("#text_message").tmpl(activity.data).text();
  //dump("text: "+textTmpl+"\n");
  var htmlTmpl = "<html><body>"+$("#html_message").tmpl(activity.data).html()+"</body></html>";
  //dump("html: "+htmlTmpl+"\n");

      var smtpArgs = {
        xoauth: oauthConfig,
        server: 'smtp.gmail.com',
        port: 587,
        connectionType: 'starttls',
        email: activity.data.userid,
        username: activity.data.username,
        senderName: activity.data.username
      };
      navigator.mozActivities.services.sendEmail.call(smtpArgs,
        {
          to: activity.data.to,
          subject: activity.data.subject,
          html: htmlTmpl,
          text: textTmpl,
          thumbnail: activity.data.picture_base64
        },
        function result(json) {
          dump("got gmail send result "+JSON.stringify(json)+"\n");
          if ('error' in json) {
              var message = json.error.message || json.error.reply;
              activity.postException({code:"error", message:message});
          } else {
              activity.postResult(json)
          }
        });
    },

    resolveRecipients: function(activity, credentials) {
      navigator.mozActivities.services.resolveEmailAddresses.call(activity.data.names, function(result) {
        if ('error' in result) {
          activity.postException(result.error);
        } else {
          // result.result is already in the format we need.
          activity.postResult(result.result);
        }
      });
    }
  };

  // Bind the OWA messages
  navigator.mozActivities.services.registerHandler('link.send', 'confirm', function(activity, credentials) {
    api.send(activity, credentials);
  });

  navigator.mozActivities.services.registerHandler('link.send', 'getLogin', function(activity, credentials) {
    common.getLogin(domain, activity, credentials);
  });

  navigator.mozActivities.services.registerHandler('link.send', 'setAuthorization', function(activity, credentials) {
    api.getProfile(activity, credentials);
  });

  navigator.mozActivities.services.registerHandler('link.send', 'logout', function(activity, credentials) {
    clearStorage(activity, credentials);
  });

  // Get a list of recipient names for a specific shareType.  Only returns
  // the names to avoid leaking full profile information for all our contacts
  // (some of whom may have profiles private to the rest of the world.)
  // A super-anal service who thinks even this is leaking too much is free to
  // return an empty list.
  // This means the onus then falls back on us to match these names back up
  // with our PoCo records so we can extract the userid.
  navigator.mozActivities.services.registerHandler('link.send', 'getShareTypeRecipients', function(activity, credentials) {
    var type;
    var args = activity.data;
    var ckey = api.key+'.email';
    var strval = window.localStorage.getItem(ckey);
    var byEmail = JSON.parse(strval);
    // convert back to a simple array of names to use for auto-complete.
    var toFormat = [];
    var result = [];
    for (var email in byEmail) {
      var poco = byEmail[email];
      toFormat.push([poco.displayName, email])
    }
    // Now format the addresses into something we can later parse.
    navigator.mozActivities.services.formatEmailAddresses.call(toFormat, function(result) {
      if ('error' in result) {
        activity.postException(result.error);
      } else {
        // result.result is already in the format we need.
        activity.postResult(result.result);
      }
    });
  });

  navigator.mozActivities.services.registerHandler('link.send', 'resolveRecipients', function(activity, credentials) {
    api.resolveRecipients(activity, credentials);
  });

  navigator.mozActivities.services.registerHandler('link.send', 'getParameters', function(activity, credentials) {
    // This is currently slightly confused - it is both link.send parameters and auth parameters.
    activity.postResult(parameters);
  });

  // Tell OWA we are now ready to be invoked.
  navigator.mozActivities.services.ready();
});
