/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

Cu.import("resource://services-share/store.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const STORE_FILENAME = "fx_share_accounts";
const FILE_PERMS = 0600;
const PR_RDONLY  = 0x01;
const gProfD = do_get_profile();

const storeFile = gProfD.clone();
storeFile.append(STORE_FILENAME);

let loginManagerCrypto = Cc["@mozilla.org/login-manager/crypto/SDR;1"]
                           .getService(Ci.nsILoginManagerCrypto);

const TEST_DATA = "contains \u00fcnic\u00f6de characters";
const TEST_DATA2 = "different data";

let gTests = [];

function readFile(file, callback) {
  NetUtil.asyncFetch(storeFile, function(stream) {
    callback(NetUtil.readInputStreamToString(stream, stream.available()));
  });
}

// First try to read when the file doesn't exist yet.
gTests.push(function test_read_nonexistent() {
  SecureFileStore.fetch(function (status, data) {
    do_check_eq(status, Cr.NS_ERROR_FILE_NOT_FOUND);
    do_check_eq(data, null);
    run_next_test();
  });
});

// Test the write functionality. The data is encrypted.
gTests.push(function test_store() {
  SecureFileStore.store(TEST_DATA, function (status) {
    do_check_true(Components.isSuccessCode(status));
    readFile(storeFile, function(fileContents) {
      do_check_eq(loginManagerCrypto.decrypt(fileContents), TEST_DATA);
      run_next_test();
    });
  });
});

// Test the read functionality.
gTests.push(function test_fetch() {
  SecureFileStore._data = null; // make sure we actually read from file
  SecureFileStore.fetch(function (status, data) {
    do_check_true(Components.isSuccessCode(status));
    do_check_eq(data, TEST_DATA);
    run_next_test();
  });
});

// Test the caching functionality.
gTests.push(function test_cache() {
  // Remove the file: we still get data.
  storeFile.remove(false);
  SecureFileStore.fetch(function (status, data) {
    do_check_true(Components.isSuccessCode(status));
    do_check_eq(data, TEST_DATA);
    run_next_test();
  });
});

// Write different data.
gTests.push(function test_store_again() {
  SecureFileStore.store(TEST_DATA2, function (status) {
    do_check_true(Components.isSuccessCode(status));
    readFile(storeFile, function(fileContents) {
      do_check_eq(loginManagerCrypto.decrypt(fileContents), TEST_DATA2);

      SecureFileStore.fetch(function (status, data) {
        do_check_true(Components.isSuccessCode(status));
        do_check_eq(data, TEST_DATA2);
        run_next_test();
      });
    });
  });
});

gTests.push(function test_clear() {
  SecureFileStore.clear();
  SecureFileStore.fetch(function (status, data) {
    do_check_eq(status, Cr.NS_ERROR_FILE_NOT_FOUND);
    do_check_eq(data, null);

    // Clearing again won't do any harm.
    SecureFileStore.clear();
    run_next_test();
  });
});

function run_test() {
  run_next_test();
}
