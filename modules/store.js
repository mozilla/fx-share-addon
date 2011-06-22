/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philipp von Weitershausen <philipp@weitershausen.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const STORE_FILENAME = "fx_share_accounts";
const CONTENT_TYPE = "text/plain"; // file contains base64
const FILE_PERMS = 0600;
const MODE_FLAGS = FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE |
                   FileUtils.MODE_TRUNCATE;

const KEY_CHANGED_TOPIC = "services:share:store:key-changed";
const CLEARED_TOPIC     = "services:share:store:cleared";
const PASSWORDMGR_STORAGE_CHANGED_TOPIC = "passwordmgr-storage-changed";

const EXPORTED_SYMBOLS = ["SecureKeyValueStore", "SecureFileStore"];

function _notifyKeyChanged(subject) {
  subject.QueryInterface = XPCOMUtils.generateQI([]);
  subject.wrappedJSObject = subject;
  Services.obs.notifyObservers(subject, KEY_CHANGED_TOPIC, null);
}

// Wipe the store when all the local password store is deleted.
Services.obs.addObserver(function onStorageChanged(subject, topic, data) {
  if (data == "removeAllLogins") {
    SecureKeyValueStore.removeAll();
  }
}, PASSWORDMGR_STORAGE_CHANGED_TOPIC, false);

/**
 * Key value store
 */
const SecureKeyValueStore = {

  /**
   * Get all keys and their values from the store.
   * 
   * @param callback
   *        Function that is called with the object containing the data as a
   *        parameter. The callback "owns" that object, i.e. it may modify it
   *        without affecting the underlying storage.
   */
  getAll: function getAll(aCallback) {
    SecureFileStore.fetch(function(aStatusCode, aData) {
      let data;
      try {
        data = JSON.parse(aData);
      } catch (ex) {
        data = null;
      }
      aCallback(data);
    });
  },

  /**
   * Get a key from the store.
   * 
   * @param key
   *        Key to be fetched.
   * @param callback
   *        Function that is called with these parameters:
   *        - key that was requested
   *        - value corresponding to the key
   */
  get: function get(aKey, aCallback) {
    this.getAll(function(aData) {
      if (!aData|| !(aKey in aData)) {
        aCallback(null);
        return;
      }
      aCallback(aData[aKey]);
    });
  },

  /**
   * Associate a value with a key in the store.
   *
   * @param key
   *        Key to associate the data with.
   * @param value
   *        Data value.
   *
   * Sends the 'services:share:store:key-changed' observer notification
   * when the data has been stored.
   */
  set: function set(aKey, aValue) {
    this.getAll(function(aData) {
      if (!aData) {
        aData = {};
      }
      aData[aKey] = aValue;
      SecureFileStore.store(JSON.stringify(aData), function() {
        _notifyKeyChanged({key: aKey, value: aValue});
      });
    });    
  },

  /**
   * Remove a value from the store that's associated with a particular key.
   *
   * @param key
   *        Key that the data is associated with.
   *
   * Sends the 'services:share:store:key-changed' observer notification
   * when the value has been removed.
   */
  remove: function remove(aKey) {
    this.getAll(function(aData) {
      if (!aData || !(aKey in aData)) {
        _notifyKeyChanged({key: aKey, value: null});
        return;
      }
      delete aData[aKey];
      SecureFileStore.store(JSON.stringify(aData), function() {
        _notifyKeyChanged({key: aKey, value: null});
      });
    });
  },

  /**
   * Clear all data from the store.
   *
   * Sends the 'services:share:store:cleared' observer notification when
   * the data has been cleared.
   */
  removeAll: function removeAll() {
    SecureFileStore.clear();
    Services.obs.notifyObservers(null, CLEARED_TOPIC, null);
  }
};


/**
 * Store data in an encrypted file in the profile directory.
 */
const SecureFileStore = {

  // Lazy properties defined below.
  _file: null,
  _converter: null,
  _crypto: null,

  // Cache the data here.
  _data: null,

  /**
   * Fetch data from the file.
   *
   * @param callback
   *        Function that's called with the following parameters:
   *        - status code
   *        - resulting data as string
   */
  fetch: function fetch(aCallback) {
    // Returned cached data if available.
    if (this._data !== null) {
      aCallback(Cr.NS_OK, this._data);
      return;
    }

    // Gracefully handle non-existent files.
    if (!this._file.exists()) {
      aCallback(Cr.NS_ERROR_FILE_NOT_FOUND, null);
      return;
    }

    // Read the data asynchronously. Use a content-type hint to circumvent
    // expensive content-type guessing on some platforms.
    let channel = NetUtil.newChannel(this._file);
    channel.contentType = CONTENT_TYPE;
    function onFetch(aInputStream, aStatusCode, aRequest) {
      if (!Components.isSuccessCode(aStatusCode)) {
        aCallback(aStatusCode, null);
        return;
      }
      let ciphertext = NetUtil.readInputStreamToString(aInputStream,
                                                       aInputStream.available());
      this._data = this._crypto.decrypt(ciphertext);
      aCallback(aStatusCode, this._data);
    }
    NetUtil.asyncFetch(channel, onFetch.bind(this));
  },

  /**
   * Store data to a file in the profile directory.
   *
   * @param aData
   *        String data to store.
   * @param aCallback
   *        Function that's called with the status code when the data
   *        has been written (optional.)
   */
  store: function store(aData, aCallback) {
    this._data = aData;

    // The ciphertext will be base64 so we can simply use an ASCII stream
    // converter. Write the data asynchronously, deferring the opening of
    // the file until it's actually written.
    let ciphertext = this._crypto.encrypt(aData);
    let inputStream = this._converter.convertToInputStream(ciphertext);
    let outputStream = Cc["@mozilla.org/network/safe-file-output-stream;1"]
                         .createInstance(Ci.nsIFileOutputStream);
    outputStream.init(this._file, MODE_FLAGS, FILE_PERMS,
                      outputStream.DEFER_OPEN);
    NetUtil.asyncCopy(inputStream, outputStream, function(aStatusCode) {
      if (typeof aCallback === "function") {
        aCallback(aStatusCode);
      }
    });
  },

  /**
   * Clear the data by removing the file from the profile directory.
   */
  clear: function clear() {
    this._data = null;
    if (this._file.exists()) {
      this._file.remove(false);
    }
  }
};
XPCOMUtils.defineLazyGetter(SecureFileStore, "_file", function() {
  return FileUtils.getFile("ProfD", [STORE_FILENAME]);
});
XPCOMUtils.defineLazyGetter(SecureFileStore, "_converter", function() {
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                    .createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "ASCII";
  return converter;
});
XPCOMUtils.defineLazyServiceGetter(SecureFileStore, "_crypto",
                                   "@mozilla.org/login-manager/crypto/SDR;1",
                                   "nsILoginManagerCrypto");
