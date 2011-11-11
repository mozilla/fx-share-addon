define([ "require", "jquery", "jquery.tmpl"
         ],
function (require,   $) {
  var options,
      owaservices = [], // A list of OWA service objects
      owaservicesbyid = {}, // A map version of the above
      port = window.navigator.mozApps.mediation.port;

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
      $("#accountTemplate" ).tmpl({svc: svc}).appendTo("#content");
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
      svc.state = "fetching";
      _updateServicePanels();
      svc.call("fetch", {count: 50},
        function(result) {
          // pass the items back up to our "agent" who is trusted and can
          // stash the items in a DB.
          port.emit("fxas.consume", {app: appid, items: result.items});
          svc.state = "idle";
          _updateServicePanels();
        },
        function(errob) {
          dump("get failed: " + JSON.stringify(errob) + "\n");
          svc.state = "idle";
          _updateServicePanels();
        }
      );
    });
  };

  $(".confirm").bind("click", function() {
    port.emit('fxas.result');
  });

  // setup a handler for the result of our 'count' requests.
  port.on('fxas.count.result', function(result) {
    owaservicesbyid[result.value].count = result.count;
    _updateServicePanels();
  });

  // and for our "consume" requests
  port.on("fxas.consume.result", function(result) {
    port.emit("fxas.count", {name: "app", value: result.app});
    // and the result will cause _updateServicePanels to be called.
  })

  // tell OWA we are ready...
  window.navigator.mozApps.mediation.ready(
    function configureServices(activity, services) {
      _deleteOldServices();
      options = activity.data;
      owaservices = services;

      for (var i = 0; i < services.length; i++) {
        var svc = services[i];
        svc.state = "initializing";
        svc.count = 0;
        owaservicesbyid[svc.app.origin] = svc;
        $("#frame-garage").append(svc.iframe);
        port.emit("fxas.count", {name: "app", value: svc.app.origin});
      }
      _updateServicePanels();
      for (var i = 0; i < services.length; i++) {
        var svc = services[i];
        svc.on("serviceChanged", function() {
          var readyService = this;
          readyService.call("getLogin", {}, function(result) {
            readyService.user = result.user;
            _updateServicePanels();
          });
        }.bind(svc));
        svc.on("ready", function() {
          _updateServicePanels();
          var readyService = this;
          readyService.call("getLogin", {}, function(result) {
            readyService.user = result.user;
            readyService.state = "idle";
            _updateServicePanels();
          });
        }.bind(svc));
      }
    },
    function updateActivity(activity) {
      // may not need to do anything for this mediator, it isn't reacting
      // to page data at all.
    }
  );

});
