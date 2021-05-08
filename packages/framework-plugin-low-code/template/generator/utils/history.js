import { createHashHistory, createBrowserHistory } from 'history';

const createHistory = (options, isHash = false) => {
  if (process.env.isApp || isHash) {
    return createHashHistory({
      ...options,
      basename: '', // The base URL of the app (see below)
    });
  }
  return createBrowserHistory(options);
};

let history = createHistory(
  {
    basename: '', // The base URL of the app (see below)
    // forceRefresh: false, // Set true to force full page refreshes
    // keyLength: 6, // The length of location.key
  },
  true
);
window._WEAPPS_HISTORY = history;

function generateBrowserHistory(param) {
  history = createBrowserHistory(param);
  window._WEAPPS_HISTORY = history;
  return history;
}

function generateHashHistory(param) {
  history = createHashHistory(param);
  window._WEAPPS_HISTORY = history;
  return history;
}

export { history, createHistory, generateBrowserHistory, generateHashHistory };
