(function () {
  'use strict';

  var props = (window.$wujie && window.$wujie.props) || null;
  var propsEl = document.getElementById('props-status');
  var shieldEl = document.getElementById('shield-status');

  if (props) {
    propsEl.classList.add('badge-ok');
    propsEl.textContent = '\u2713 wujie props connected';
    document.getElementById('product-name').textContent = props.productInfo?.name || 'N/A';
    document.getElementById('theme').textContent = props.isDark ? '🌙 Dark' : '☀️ Light';
    document.getElementById('locale').textContent = props.locale || 'N/A';
  } else {
    propsEl.classList.add('badge-fail');
    propsEl.textContent = '\u2717 wujie props not available';
  }

  // Sandbox isolation test
  try {
    var parentApi = window.parent && window.parent.api;
    if (parentApi) {
      shieldEl.textContent = 'LEAK: parent.api accessible';
      shieldEl.classList.add('badge-fail');
    } else {
      shieldEl.textContent = '\u2713 BLOCKED: parent.api shielded';
      shieldEl.classList.add('badge-ok');
    }
  } catch (e) {
    shieldEl.textContent = '\u2713 BLOCKED: ' + e.message;
    shieldEl.classList.add('badge-ok');
  }

  // Notify parent
  if (props && typeof props.onMessage === 'function') {
    props.onMessage({ type: 'ready', routeKey: 'alpha' });
  }
})();
