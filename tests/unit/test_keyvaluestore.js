/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

Cu.import("resource://services-share/store.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const KEY_CHANGED_TOPIC = "services:share:store:key-changed";
const CLEARED_TOPIC     = "services:share:store:cleared";

const gProfD = do_get_profile();
let loginManager = Cc["@mozilla.org/login-manager;1"]
                     .getService(Ci.nsILoginManager);

function onKeyChangedObserved(callback) {
  Services.obs.addObserver({
    observe: function observe(subject, topic, data) {
      Services.obs.removeObserver(this, KEY_CHANGED_TOPIC);
      callback(subject.wrappedJSObject);
    }
  }, KEY_CHANGED_TOPIC, false);
}

function onStoreCleared(callback) {
  Services.obs.addObserver({
    observe: function observe(subject, topic, data) {
      Services.obs.removeObserver(this, CLEARED_TOPIC);
      callback();
    }
  }, CLEARED_TOPIC, false);
}


let gTests = [];

gTests.push(function test_getAll_noData() {
  SecureKeyValueStore.getAll(function(data) {
    do_check_eq(data, null);
    run_next_test();
  });
});

gTests.push(function test_get_noData() {
  const nonexistentKey = "nonexistentKey";

  SecureKeyValueStore.get(nonexistentKey, function(value) {
    do_check_eq(value, null);
    run_next_test();
  });
});

const testdata = {
  somekey: "somevalue",
  anotherkey: "another value"
};

gTests.push(function test_set_noData() {
  onKeyChangedObserved(function(info) {
    do_check_eq(info.key, "somekey");
    do_check_eq(info.value, testdata.somekey);
    run_next_test();
  });
  SecureKeyValueStore.set("somekey", testdata.somekey);
});

gTests.push(function test_get_withData() {
  SecureKeyValueStore.get("somekey", function(value) {
    do_check_eq(value, testdata.somekey);
    run_next_test();
  });
});

gTests.push(function test_set_another() {
  onKeyChangedObserved(function(info) {
    do_check_eq(info.key, "anotherkey");
    do_check_eq(info.value, testdata.anotherkey);
    run_next_test();
  });
  SecureKeyValueStore.set("anotherkey", testdata.anotherkey);
});

gTests.push(function test_getAll() {
  SecureKeyValueStore.getAll(function(data) {
    let expectedkeys = Object.keys(testdata).sort();
    let keys = Object.keys(data).sort();

    do_check_eq(keys.length, expectedkeys.length);
    for (let i = 0; i < keys.length; i++) {
      do_check_eq(keys[i], expectedkeys[i]);
      do_check_eq(data[keys[i]], testdata[keys[i]]);
    }

    run_next_test();
  });
});

gTests.push(function test_remove() {
  onKeyChangedObserved(function(info) {
    do_check_eq(info.key, "somekey");
    do_check_eq(info.value, null);
    run_next_test();
  });
  SecureKeyValueStore.remove("somekey");
});

gTests.push(function test_remove_nonexistent() {
  onKeyChangedObserved(function(info) {
    do_check_eq(info.key, "nonexistent");
    do_check_eq(info.value, null);
    run_next_test();
  });
  SecureKeyValueStore.remove("nonexistent");
});

gTests.push(function test_removeAll() {
  onStoreCleared(function() {
    SecureKeyValueStore.getAll(function(data) {
      do_check_eq(data, null);

      // Removing all keys again won't do any harm.
      SecureKeyValueStore.removeAll();
      run_next_test();
    });
  });
  SecureKeyValueStore.removeAll();
});

gTests.push(function test_removeAllLogins() {
  // Add some data to the store first.
  onKeyChangedObserved(function(info) {
    // Wipe password storage.
    loginManager.removeAllLogins();
    // Ensure stuff is really gone.
    SecureKeyValueStore.getAll(function(data) {
      do_check_eq(data, null);
      run_next_test();
    });
  });
  SecureKeyValueStore.set("somekey", testdata.somekey);
});

function run_test() {
  run_next_test();
}
