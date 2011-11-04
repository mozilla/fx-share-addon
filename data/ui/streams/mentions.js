define([ "require", "jquery", "jquery.tmpl"
         ],
function (require,   $) {

  // fetchActivityItems is injected by our companion contentScript.
  fetchActivityItems(function(items) {
    for each (var item in items) {
      // do some simple normalization of the items for our template.
      var tplitem = {
        from: item.actor || item.author,
        displayName: item.displayName,
        content: item.object.content
      };
      $("#itemTemplate" ).tmpl(tplitem).appendTo("#content");
    }
  });
});
