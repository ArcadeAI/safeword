# bun.lock change and resolved zod/undici graph

Base `f211c4c30` → head `755584790`. Generated with `git diff f211c4c30 755584790 -- bun.lock`; `bun install --frozen-lockfile` succeeds at the head (local 2026-11-02, and every CI job's install step in runs 41366259506 and 41507437273).

```diff
diff --git a/bun.lock b/bun.lock
index 22c17f57d..1dd534643 100644
--- a/bun.lock
+++ b/bun.lock
@@ -137,9 +137,10 @@
     "source-map-js": "1.2.2",
     "svgo": "^4.1.0",
     "turbo": "2.9.18",
-    "undici": "8.11.2",
+    "undici": "8.12.2",
     "vite": "8.2.4",
     "yaml": "^2.9.0",
+    "zod": "4.6.6",
     "zod-validation-error": "^4.0.0",
   },
   "packages": {
@@ -2353,7 +2354,7 @@
 
     "uncrypto": ["uncrypto@0.1.3", "", {}, "sha512-Ql87qFHB3s/De2ClA9e0gsnS6zXG27SkTiSJwjCc9MebbfapQfuPzumMIUMi38ezPZVNFcHI9sUIepeQfw8J8Q=="],
 
-    "undici": ["undici@8.11.2", "", {}, "sha512-u4UB2/IrKdU6lFxumHmmo1a3fCQO5tzQllRorfoRS63txhrB7xTpSn1PftwC4qEHkOaqP95fCWW4lJzwErwzhQ=="],
+    "undici": ["undici@8.12.2", "", {}, "sha512-XtuDWVdqTLr3NAxm2ly9/hU6kUsJOgGh1RASzMBbsw6aWCOaQzHdW+QQDfdERjfJ2V5vL5pRPa4RetO9UfivDg=="],
 
     "undici-types": ["undici-types@8.9.0", "", {}, "sha512-KTDyRTYX8sWmKXAikPHHSyc63CRPETMctyjKFupcC6OBLXT3xsN0e9aF7m+mIXutFWpUXuedtowG7iLOzp0kQg=="],
 
@@ -2493,7 +2494,7 @@
 
     "yup": ["yup@1.7.1", "", { "dependencies": { "property-expr": "^2.0.5", "tiny-case": "^1.0.3", "toposort": "^2.0.2", "type-fest": "^2.19.0" } }, "sha512-GKHFX2nXul2/4Dtfxhozv701jLQHdf6J34YDh2cEkpqoo8le5Mg6/LrdseVLrF
 
-    "zod": ["zod@4.4.3", "", {}, "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="],
+    "zod": ["zod@4.6.6", "", {}, "sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA=="],
 
     "zod-validation-error": ["zod-validation-error@4.0.2", "", { "peerDependencies": { "zod": "^3.25.0 || ^4.0.0" } }, "sha512-Q6/nZLe6jxuU80qb/4uJ4t5v2VEZ44lzQjPDhYJNztRQ4wyWc6VF3D3Kb/fAuPetZQnhS3hnajCf9CsWesghLQ=="],
 
@@ -2603,8 +2604,6 @@
 
     "astro/obug": ["obug@3.0.0", "", {}, "sha512-5vvB5+W7ePv+p3uqxi+RcW1XAzLW0/hxt3/4X4Lc4qHudzOhmBiBwOY6DRob4WnanAEGvNcLjF+KNOufrUoEQw=="],
 
-    "astro/zod": ["zod@4.6.5", "", {}, "sha512-v5l/aFXZQeai4awLbOpSoHecE9UiMrnfx75tEXLjNonXVARxQ5mOeipTjROUchszUNCqnE+hqAMujRsRHsut2Q=="],
-
     "astro-eslint-parser/@astrojs/compiler-rs": ["@astrojs/compiler-rs@0.3.2", "", { "dependencies": { "@astrojs/compiler-binding": "0.3.2" } }, "sha512-xlx/T7JovIKduu4ucbTQUxQ5+Q8wxkHxhLjnZk3VlJbhbQ9RLvvuDk1p2YYFYFQ5y1
 
     "astro-eslint-parser/@typescript-eslint/scope-manager": ["@typescript-eslint/scope-manager@8.66.0", "", { "dependencies": { "@typescript-eslint/types": "8.66.0", "@typescript-eslint/visitor-keys": "8.66.0" } }, "sha
```

## Resolved entries at head

```text
2357:    "undici": ["undici@8.12.2", "", {}, <integrity>],
2497:    "zod": ["zod@4.6.6", "", {}, <integrity>],

"undici": "8.12.2"
"zod": "4.6.6"
"@astrojs/sitemap": ["@astrojs/sitemap@3.7.3""zod": "^4.3.6"
"@eslint-react/shared": ["@eslint-react/shared@5.23.5""zod": "^3.25.0 || ^4.0.0"
"astro": ["astro@7.3.5""zod": "^4.5.4"
"eslint-plugin-react-hooks": ["eslint-plugin-react-hooks@7.1.1""zod": "^3.25.0 || ^4.0.0"
"knip": ["knip@6.39.0""zod": "^4.4.3"
"unifont": ["unifont@0.7.5""undici": "^8.0.0"
"zod-validation-error": ["zod-validation-error@4.0.2""zod": "^3.25.0 || ^4.0.0"
```
