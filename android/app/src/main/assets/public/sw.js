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
    "url": "xpresso_splash_bg.svg",
    "revision": "4ffcb9ffe12a1654451c3813a4c9d0a6"
  }, {
    "url": "xpresso_logo_logo.svg",
    "revision": "dbebd9ff0920935f7a723dd1322201c7"
  }, {
    "url": "pwa-512x512.png",
    "revision": "6b80fd3906996064aed1189948c8e6e2"
  }, {
    "url": "pwa-192x192.png",
    "revision": "30c5805380c1702d482fd99e0a975457"
  }, {
    "url": "index.html",
    "revision": "180d2a733dd5894e251c91dda8f9f206"
  }, {
    "url": "favicon.svg",
    "revision": "7cc9711d60890bebc14b814c9fe01ad8"
  }, {
    "url": "favicon.png",
    "revision": "1c731873e6a46d8229aa2f597376eb40"
  }, {
    "url": "favicon.ico",
    "revision": "1c731873e6a46d8229aa2f597376eb40"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "a8db639600dcc8ee8aa80e5aa4fb1027"
  }, {
    "url": "Xpresso_icon.svg",
    "revision": "7cc9711d60890bebc14b814c9fe01ad8"
  }, {
    "url": "Splash_screen_comp.png",
    "revision": "c5113f86e60bd0cb30e444a57ef2868c"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/web-DNiGZWEd.js",
    "revision": null
  }, {
    "url": "assets/web-CRSlEoRq.js",
    "revision": null
  }, {
    "url": "assets/web-BY8DZ0fg.js",
    "revision": null
  }, {
    "url": "assets/web-BOu-_cRE.js",
    "revision": null
  }, {
    "url": "assets/web-BI6o0g52.js",
    "revision": null
  }, {
    "url": "assets/web-8qrdA1gi.js",
    "revision": null
  }, {
    "url": "assets/unread-B6WvO_3y.js",
    "revision": null
  }, {
    "url": "assets/supabaseReplicationService-DbsGLg0s.js",
    "revision": null
  }, {
    "url": "assets/sdk-cSPAYPKb.js",
    "revision": null
  }, {
    "url": "assets/purify.es-BSKMTLSQ.js",
    "revision": null
  }, {
    "url": "assets/nativeNotificationService-BXCFUd8O.js",
    "revision": null
  }, {
    "url": "assets/mediaCacheService-xhfK88fn.js",
    "revision": null
  }, {
    "url": "assets/live-update-Brr3zuXj.js",
    "revision": null
  }, {
    "url": "assets/index.es-B-kSSQJN.js",
    "revision": null
  }, {
    "url": "assets/index-DqNjCF2e.css",
    "revision": null
  }, {
    "url": "assets/index-DYnozudx.js",
    "revision": null
  }, {
    "url": "assets/index-C9feYF81.js",
    "revision": null
  }, {
    "url": "assets/index-BhluVngX.js",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-BzfVsbfJ.js",
    "revision": null
  }, {
    "url": "assets/backgroundSyncService--9weiU6P.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "a8db639600dcc8ee8aa80e5aa4fb1027"
  }, {
    "url": "favicon.ico",
    "revision": "1c731873e6a46d8229aa2f597376eb40"
  }, {
    "url": "pwa-192x192.png",
    "revision": "30c5805380c1702d482fd99e0a975457"
  }, {
    "url": "pwa-512x512.png",
    "revision": "6b80fd3906996064aed1189948c8e6e2"
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
