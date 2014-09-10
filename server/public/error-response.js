(function(exports, body, head) {

  var state = document.readyState;
  var err = {
    title: '{title}',
    file: '{filename}',
    reason: decodeURIComponent("{reason}"),
    body: decodeURIComponent("{body}"),
    style: decodeURIComponent("{style}")
  };

  console.error(err.title, 'in', err.file);
  console.error(err.reason);
  exports.err = err;

  // XXX fancier way to do contentloaded without relying on jQuery, probably
  // rely on:
  //
  // > https://github.com/dperini/ContentLoaded/blob/master/src/contentloaded.js

  document.addEventListener('onDOMContentLoaded', report, false);
  if(state === 'complete') report();
  else {
    document.addEventListener('DOMContentLoaded', report, false);
  }

  function report() {
    var body = document.body;
    var head = document.head;
    var styles = Array.prototype.slice.call(document.querySelectorAll('head style, head link'));

    // update body with compilation errors
    body.innerHTML = '<h1>' + err.title + '</h1>';
    body.innerHTML += err.body;

    // remove old style
    styles.forEach(function(el) {
      head.removeChild(el);
    });

    // insert compilation error styles
    var style = document.createElement('style');
    head.appendChild(style);
    style.innerHTML = err.style;
  }

})(this);
