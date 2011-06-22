/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

gTests.push(function test_storeGet_empty() {
  let message = {topic: "storeGet", data: "hypnotoad"};
  relayMessage(message, function() {
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "storeGetReturn");
      // Store is empty so the data is null.
      is(message.data.key, "hypnotoad");
      is(message.data.value, null);
      run_next_test();
    });
  });
});

gTests.push(function test_storeSet() {
  let message = {topic: "storeSet",
                 data: {key: "hypnotoad",
                        value: "Everybody loves Hypnotoad!"}};
  relayMessage(message, function() {
    // We expect a notification about the change.
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "storeNotifyChange");
      is(message.data.key, "hypnotoad");
      is(message.data.value, "Everybody loves Hypnotoad!");
      run_next_test();
    });
  });
});

gTests.push(function test_storeGet_notEmpty() {
  let message = {topic: "storeGet", data: "hypnotoad"};
  relayMessage(message, function() {
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "storeGetReturn");
      is(message.data.key, "hypnotoad");
      is(message.data.value, "Everybody loves Hypnotoad!");
      run_next_test();
    });
  });
});

gTests.push(function test_storeSet_anotherOne() {
  let message = {topic: "storeSet",
                 data: {key: "calculon",
                        value: "I don't do two takes. Amateurs do two takes."}};
  relayMessage(message, function() {
    // We expect a notification about the change.
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "storeNotifyChange");
      is(message.data.key, "calculon");
      is(message.data.value, "I don't do two takes. Amateurs do two takes.");
      run_next_test();
    });
  });
});

gTests.push(function test_storeRemove() {
  let message = {topic: "storeRemove", data: "hypnotoad"};
  relayMessage(message, function() {
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "storeNotifyChange");
      is(message.data.key, "hypnotoad");
      is(message.data.value, null);
      run_next_test();
    });
  });
});

gTests.push(function test_storeGet_removed() {
  let message = {topic: "storeGet", data: "hypnotoad"};
  relayMessage(message, function() {
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "storeGetReturn");
      // Store is empty so the data is null.
      is(message.data.key, "hypnotoad");
      is(message.data.value, null);
      run_next_test();
    });
  });
});

gTests.push(function test_storeRemove_nonexistent() {
  let message = {topic: "storeRemove", data: "nonexistent"};
  relayMessage(message, function() {
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "storeNotifyChange");
      is(message.data.key, "nonexistent");
      is(message.data.value, null);
      run_next_test();
    });
  });
});

gTests.push(function test_storeRemoveAll() {
  let message = {topic: "storeRemoveAll"};
  relayMessage(message, function() {
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "storeNotifyRemoveAll");
      run_next_test();
    });
  });
});
