/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-66fd3bc2'], (function (workbox) { 'use strict';

  self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "28744b7045a921e2ff971da971b90c52"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/web-D2_3PULM.js",
    "revision": null
  }, {
    "url": "assets/web-BdMcuwFR.js",
    "revision": null
  }, {
    "url": "assets/web-B2DzFJ-b.js",
    "revision": null
  }, {
    "url": "assets/supabaseReplicationService-CsOu0cOG.js",
    "revision": null
  }, {
    "url": "assets/sdk-g925KiZX.js",
    "revision": null
  }, {
    "url": "assets/purify.es-BSKMTLSQ.js",
    "revision": null
  }, {
    "url": "assets/mediaCacheService-xhfK88fn.js",
    "revision": null
  }, {
    "url": "assets/index.es-5HkYl10I.js",
    "revision": null
  }, {
    "url": "assets/index-We-_RTYo.js",
    "revision": null
  }, {
    "url": "assets/index-Dvzx8W34.js",
    "revision": null
  }, {
    "url": "assets/index-Dd3G529q.js",
    "revision": null
  }, {
    "url": "assets/index-BvrxnoFB.css",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-BzfVsbfJ.js",
    "revision": null
  }, {
    "url": "assets/backgroundSyncService-Bne5nqre.js",
    "revision": null
  }, {
    "url": "manifest.webmanifest",
    "revision": "35d6bbcf4b0863082075d16521fc8ebe"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/.*\.supabase\.co\/.*/, new workbox.NetworkFirst({
    "cacheName": "supabase-api-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 86400
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
