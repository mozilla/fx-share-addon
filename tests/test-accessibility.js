const {getSharePanelWithApp} = require("./app_helpers");

// Test that when the account is not logged in the "login" button has focus.
exports.testAriaOnTabs = function(test) {
  test.waitUntilDone();
  let params = {shareTypes: [{type: 'somewhere', name: 'somewhere'}]};

  getSharePanelWithApp(test, {}, function(appInfo) {
    let {jqPanelContentWindow} = appInfo;
    // The owner of the tabs must have the tablist role.
    test.assertEqual(jqPanelContentWindow("#tabs").attr("role"), "tablist")
    // and each tab should have the "tab" role, exactly 1 with
    // aria-selected="true" and the rest with aria-selected="false"
    let buttons = jqPanelContentWindow('.widgets-TabButton');
    let num_true = 0, num_false = 0;
    for (let i = 0; i < buttons.length; i++) {
      let button = buttons[i];
      let attr = button.getAttribute("aria-selected")
      if (attr === "true") {
        num_true += 1;
      } else if (attr === "false") {
        num_false += 1;
      } // else it has no aria-selected attribute which is bad!
      test.assertEqual(button.getAttribute("role"), "tab");
    }
    test.assertEqual(num_true, 1);
    test.assertEqual(num_false, buttons.length-1);
    test.done();
  });
}
