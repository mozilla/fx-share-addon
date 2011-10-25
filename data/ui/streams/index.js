define([ "require", "jquery", "jquery.tmpl"
         ],
function (require,   $) {
  var options,
      owaservices = [], // A list of OWA service objects
      owaservicesbyid = {}; // A map version of the above

  function _deleteOldServices() {
    while (owaservices.length) {
      var svcRec = owaservices.pop();
      if (svcRec.subAcctsChanged) {
        dispatch.unsub(svcRec.subAcctsChanged);
      }
    }
    owaservicesbyid = {};
    $("#frame-garage").empty();// this will remove iframes from DOM
    $("#content").empty();
  };

  function _updateServicePanels() {
    // this kinda sucks - I can't work out how to update a template - so we
    // just rebuild them all.
    $(".fetchButton").unbind("click");
    $(".login").unbind("click");

    $("#content").empty();
    for (var i = 0; i < owaservices.length; i++) {
      var svc = owaservices[i];
      options = {icon: svc.getIconForSize(48)}
      $("#accountTemplate" ).tmpl(svc, options).appendTo("#content");
    }
    $(".login").bind("click", function() {
      var selectedItem = $.tmplItem(this);
      var appid = $(selectedItem.nodes).attr("app");
      var svc = owaservicesbyid[appid];
      navigator.mozApps.mediation.startLogin(svc.app.origin);
    });

    $(".fetchButton").bind("click", function() {
      var selectedItem = $.tmplItem(this);
      var appid = $(selectedItem.nodes).attr("app");
      var svc = owaservicesbyid[appid];
      svc.call("fetch", {count: 50},
        function(result) {
          dump("get worked - got " + result.items.length + " items\n");
        },
        function(errob) {
          dump("get failed: " + JSON.stringify(errob) + "\n");
        }
      );
    });
  };

  // tell OWA we are ready...
  window.navigator.mozApps.mediation.ready(
    function(activity, services) {
      _deleteOldServices();
      options = activity.data;
      owaservices = services;

      for (var i = 0; i < services.length; i++) {
        var svc = services[i];
        svc.initializing = true;
        owaservicesbyid[svc.app.origin] = svc;
        $("#frame-garage").append(svc.iframe);
      }
      _updateServicePanels();
      for (var i = 0; i < services.length; i++) {
        var svc = services[i];
        svc.on("serviceChanged", function() {
          dump("Got servicechanged\n");
          var readyService = this;
          readyService.call("getLogin", {}, function(result) {
            readyService.user = result.user;
            _updateServicePanels();
          });
        }.bind(svc));
        svc.on("ready", function() {
          _updateServicePanels();
          var readyService = this;
          readyService.initializing = false;
          readyService.call("getLogin", {}, function(result) {
            readyService.user = result.user;
            _updateServicePanels();
          });
        }.bind(svc));
      }
    }
  );

});
