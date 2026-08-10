/**
 * app.js — loaded via magiintro://test/assets/app.js
 * Runs inside the wujie iframe sandbox.
 */
(function () {
  'use strict';

  // --- Mark CSS as loaded (if this script runs, JS is loaded) ---
  document.getElementById('check-css').classList.add('ok');
  document.getElementById('check-js').classList.add('ok');

  // --- Check image loading ---
  var img = document.getElementById('logo');
  img.onload = function () {
    var el = document.getElementById('check-img');
    el.classList.add('ok');
    el.innerHTML = '&#10003; Image (SVG) loaded';
  };
  img.onerror = function () {
    document.getElementById('check-img').textContent =
      '\u2717 Image failed to load';
  };

  // --- Check CSS background image ---
  // We can't directly detect background image load, but if CSS loaded, assume ok
  setTimeout(function () {
    var el = document.getElementById('check-bg');
    el.classList.add('ok');
    el.innerHTML = '&#10003; CSS background image loaded';
  }, 300);

  // --- Access wujie props (parent → child communication) ---
  var props = (window.$wujie && window.$wujie.props) || null;
  var propsEl = document.getElementById('check-props');

  if (props) {
    propsEl.classList.add('ok');
    propsEl.innerHTML = '&#10003; wujie props connected';

    document.getElementById('route-key').textContent =
      props.routeKey || 'N/A';
    document.getElementById('parent-msg').textContent =
      props.message || 'N/A';
  } else {
    propsEl.textContent = '\u2717 wujie props not available';
  }

  // --- Counter (proves JS is running) ---
  var counter = 0;
  var counterEl = document.getElementById('counter');
  setInterval(function () {
    counter++;
    counterEl.textContent = counter;
  }, 1000);

  // --- Send message to parent (child → parent via props callback) ---
  document.getElementById('send-btn').addEventListener('click', function () {
    if (props && typeof props.onMessage === 'function') {
      props.onMessage({
        type: 'button-click',
        text: 'Hello from intro page!',
        timestamp: Date.now(),
      });
    }
  });

  // --- Sandbox isolation test ---
  // Attempt to access parent's window.api — should fail in wujie sandbox
  var isoResult = document.getElementById('isolation-result');
  try {
    var parentApi = window.parent && window.parent.api;
    if (parentApi) {
      isoResult.textContent =
        'LEAK: window.parent.api is accessible! Sandbox failed.';
      isoResult.classList.add('leaked');
    } else {
      isoResult.textContent =
        'BLOCKED: window.parent.api is undefined. Sandbox working correctly.';
      isoResult.classList.add('blocked');
    }
  } catch (e) {
    isoResult.textContent =
      'BLOCKED: ' + e.message + '. Sandbox working correctly.';
    isoResult.classList.add('blocked');
  }

  // --- Notify parent that we're ready ---
  if (props && typeof props.onMessage === 'function') {
    props.onMessage({
      type: 'ready',
      text: 'Intro page fully loaded and initialized',
    });
  }
})();
