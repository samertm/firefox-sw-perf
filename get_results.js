(function() {
  var entries = performance.getEntriesByType("resource");
  var count = 0;
  var sum = 0;

  for (var i = 0; i < entries.length; i++) {
    // Skip sw, this script, and any non-localhost resources.
    if (entries[i].name.endsWith("sw.js") ||
        entries[i].name.endsWith("get_results.js") ||
        entries[i].name.indexOf("localhost") === -1) {
      continue;
    }

    sum += entries[i].duration;
    count++;
  }
  var avg = sum / count;

  var jqueryDuration = performance.getEntriesByName("http://localhost:4445/static/jquery_security_patch_bundle-vflZOxviW.js")[0].duration;

  var output = "Loaded " + count + " resources.<br>Average duration: " + avg +
      "<br>jQuery duration: " + jqueryDuration +
      "<br>Service worker active? " + !!(navigator.serviceWorker.controller);

  // Store run if it's valid.
  if (window.RUN_IS_VALID) {
    var pathname = document.location.pathname;
    var storageKey = 'exp_data';
    var stored = localStorage.getItem(storageKey);
    var parsed;
    if (stored) {
      parsed = JSON.parse(stored);
    } else {
      parsed = {};
    }

    if (!parsed[pathname]) {
      var obj = {};
      obj.sum = 0;
      obj.count = 0;
      obj.jquery_sum = 0;
      obj.jquery_count = 0;

      parsed[pathname] = obj;
    }
    parsed[pathname].sum += sum;
    parsed[pathname].count += count
    parsed[pathname].jquery_sum += jqueryDuration;
    parsed[pathname].jquery_count++;

    localStorage.setItem(storageKey, JSON.stringify(parsed));

    output += "<br><br>From localStorage. (Run `localStorage.removeItem(\"" + storageKey + "\")` if something goes bad, e.g. you open page with dev tools open or ctrl+r)";

    var keys = ['/', '/with_sw', '/with_dbxsw', '/with_faster_dbxsw'];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      output += "<br><br><b>Key: " + key + "</b>";
      if (key in parsed) {
        output += "<br>Loaded " + parsed[key].count + " resources" +
          "<br>Average duration: " + parsed[key].sum / parsed[key].count +
          "<br>jQuery duration: " + parsed[key].jquery_sum / parsed[key].jquery_count;
      } else {
        output += "<br>(empty)";
      }
    }
  }

  document.getElementById('output').innerHTML = output;
})();
