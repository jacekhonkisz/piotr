-- Add Google Ads System User Token support
-- Migration: 052_add_google_ads_system_user_support.sql

-- Add system user token columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_system_user_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_token_type VARCHAR(20) DEFAULT 'refresh_token' CHECK (google_ads_token_type IN ('refresh_token', 'system_user'));

-- Add comments for documentation
COMMENT ON COLUMN clients.google_ads_system_user_token IS 'Google Ads System User Token for permanent access';
COMMENT ON COLUMN clients.google_ads_token_type IS 'Type of Google Ads token: refresh_token or system_user';

-- Add system settings for Google Ads system user tokens
INSERT INTO system_settings (key, value, description) VALUES
  ('google_ads_system_user_token', '""', 'Global Google Ads System User Token'),
  ('google_ads_system_user_enabled', '"true"', 'Enable system user token as alternative'),
  ('google_ads_token_preference', '"system_user"', 'Preferred token type: system_user or refresh_token')
ON CONFLICT (key) DO NOTHING;

-- Create index for better performance on token type queries
CREATE INDEX IF NOT EXISTS idx_clients_google_ads_token_type ON clients(google_ads_token_type) WHERE google_ads_enabled = true;

-- Update existing clients to use refresh_token type by default
UPDATE clients 
SET google_ads_token_type = 'refresh_token' 
WHERE google_ads_enabled = true AND google_ads_token_type IS NULL;
les/google-ads-api/build/src/customer.js:194:29)
    at async Customer.paginatedSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:157:34)
    at async Customer.querier (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:268:53)
    at async Customer.query (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:26:30)
    at async GoogleAdsAPIService.executeQuery (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:61:30)
    at async GoogleAdsAPIService.getCampaignData (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:202:30)
    at async POST (webpack-internal:///(rsc)/./src/app/api/automated/google-ads-daily-collection/route.ts:105:39)
    at async /Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/macbook/piotr/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/macbook/piotr/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/macbook/piotr/node_modules/next/dist/server/lib/start-server.js:141:13) {
  config: {
    retry: true,
    retryConfig: {
      httpMethodsToRetry: [Array],
      currentRetryAttempt: 0,
      retry: 3,
      noResponseRetries: 2,
      retryDelayMultiplier: 2,
      timeOfFirstRequest: 1759233776753,
      totalTimeout: 9007199254740991,
      maxRetryDelay: 9007199254740991,
      statusCodesToRetry: [Array]
    },
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      'x-goog-api-client': 'gl-node/20.18.0'
    },
    paramsSerializer: [Function: paramsSerializer],
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    validateStatus: [Function: validateStatus],
    responseType: 'unknown',
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      retry: true,
      retryConfig: [Object],
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      headers: [Object],
      paramsSerializer: [Function: paramsSerializer],
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      validateStatus: [Function: validateStatus],
      responseType: 'unknown',
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: { error: 'invalid_grant', error_description: 'Bad Request' },
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
      'content-encoding': 'gzip',
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 30 Sep 2025 12:02:56 GMT',
      expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
      pragma: 'no-cache',
      server: 'scaffolding on HTTPServer2',
      'transfer-encoding': 'chunked',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 400,
    statusText: 'Bad Request',
    request: { responseURL: 'https://oauth2.googleapis.com/token' }
  },
  error: undefined,
  status: 400,
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}
❌ Attempt 3 failed for Hotel Lambert Ustronie Morskie: GaxiosError: invalid_grant
    at Gaxios._request (webpack-internal:///(rsc)/./node_modules/gaxios/build/src/gaxios.js:142:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async OAuth2Client.refreshTokenNoCache (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:212:19)
    at async OAuth2Client.refreshAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:247:19)
    at async OAuth2Client.getAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:276:23)
    at async Customer.getAccessToken (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/service.js:76:27)
    at async Customer.useStreamToImitateRegularSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:194:29)
    at async Customer.paginatedSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:157:34)
    at async Customer.querier (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:268:53)
    at async Customer.query (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:26:30)
    at async GoogleAdsAPIService.executeQuery (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:61:30)
    at async GoogleAdsAPIService.getCampaignData (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:202:30)
    at async POST (webpack-internal:///(rsc)/./src/app/api/automated/google-ads-daily-collection/route.ts:105:39)
    at async /Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/macbook/piotr/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/macbook/piotr/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/macbook/piotr/node_modules/next/dist/server/lib/start-server.js:141:13) {
  config: {
    retry: true,
    retryConfig: {
      httpMethodsToRetry: [Array],
      currentRetryAttempt: 0,
      retry: 3,
      noResponseRetries: 2,
      retryDelayMultiplier: 2,
      timeOfFirstRequest: 1759233776753,
      totalTimeout: 9007199254740991,
      maxRetryDelay: 9007199254740991,
      statusCodesToRetry: [Array]
    },
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      'x-goog-api-client': 'gl-node/20.18.0'
    },
    paramsSerializer: [Function: paramsSerializer],
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    validateStatus: [Function: validateStatus],
    responseType: 'unknown',
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      retry: true,
      retryConfig: [Object],
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      headers: [Object],
      paramsSerializer: [Function: paramsSerializer],
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      validateStatus: [Function: validateStatus],
      responseType: 'unknown',
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: { error: 'invalid_grant', error_description: 'Bad Request' },
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
      'content-encoding': 'gzip',
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 30 Sep 2025 12:02:56 GMT',
      expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
      pragma: 'no-cache',
      server: 'scaffolding on HTTPServer2',
      'transfer-encoding': 'chunked',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 400,
    statusText: 'Bad Request',
    request: { responseURL: 'https://oauth2.googleapis.com/token' }
  },
  error: undefined,
  status: 400,
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}
❌ All attempts failed for Hotel Lambert Ustronie Morskie

📝 Processing Google Ads: Sandra SPA Karpacz (attempt 1)
[INFO] 🏢 Using manager customer ID: 293-100-0497
[INFO] 🔧 Creating Google Ads customer instance: {
  customerId: '859-901-9750',
  hasRefreshToken: true,
  hasManagerId: true
}
[INFO] 📊 Fetching Google Ads campaign data from 2025-09-28 to 2025-09-28
[INFO] 📊 Executing Google Ads query
[ERROR] ❌ Error executing Google Ads query: GaxiosError: invalid_grant
    at Gaxios._request (webpack-internal:///(rsc)/./node_modules/gaxios/build/src/gaxios.js:142:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async OAuth2Client.refreshTokenNoCache (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:212:19)
    at async OAuth2Client.refreshAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:247:19)
    at async OAuth2Client.getAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:276:23)
    at async Customer.getAccessToken (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/service.js:76:27)
    at async Customer.useStreamToImitateRegularSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:194:29)
    at async Customer.paginatedSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:157:34)
    at async Customer.querier (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:268:53)
    at async Customer.query (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:26:30)
    at async GoogleAdsAPIService.executeQuery (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:61:30)
    at async GoogleAdsAPIService.getCampaignData (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:202:30)
    at async POST (webpack-internal:///(rsc)/./src/app/api/automated/google-ads-daily-collection/route.ts:105:39)
    at async /Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/macbook/piotr/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/macbook/piotr/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/macbook/piotr/node_modules/next/dist/server/lib/start-server.js:141:13) {
  config: {
    retry: true,
    retryConfig: {
      httpMethodsToRetry: [Array],
      currentRetryAttempt: 0,
      retry: 3,
      noResponseRetries: 2,
      retryDelayMultiplier: 2,
      timeOfFirstRequest: 1759233776816,
      totalTimeout: 9007199254740991,
      maxRetryDelay: 9007199254740991,
      statusCodesToRetry: [Array]
    },
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      'x-goog-api-client': 'gl-node/20.18.0'
    },
    paramsSerializer: [Function: paramsSerializer],
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    validateStatus: [Function: validateStatus],
    responseType: 'unknown',
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      retry: true,
      retryConfig: [Object],
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      headers: [Object],
      paramsSerializer: [Function: paramsSerializer],
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      validateStatus: [Function: validateStatus],
      responseType: 'unknown',
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: { error: 'invalid_grant', error_description: 'Bad Request' },
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
      'content-encoding': 'gzip',
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 30 Sep 2025 12:02:56 GMT',
      expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
      pragma: 'no-cache',
      server: 'scaffolding on HTTPServer2',
      'transfer-encoding': 'chunked',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 400,
    statusText: 'Bad Request',
    request: { responseURL: 'https://oauth2.googleapis.com/token' }
  },
  error: undefined,
  status: 400,
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}
[ERROR] ❌ Error fetching Google Ads campaign data: GaxiosError: invalid_grant
    at Gaxios._request (webpack-internal:///(rsc)/./node_modules/gaxios/build/src/gaxios.js:142:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async OAuth2Client.refreshTokenNoCache (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:212:19)
    at async OAuth2Client.refreshAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:247:19)
    at async OAuth2Client.getAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:276:23)
    at async Customer.getAccessToken (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/service.js:76:27)
    at async Customer.useStreamToImitateRegularSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:194:29)
    at async Customer.paginatedSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:157:34)
    at async Customer.querier (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:268:53)
    at async Customer.query (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:26:30)
    at async GoogleAdsAPIService.executeQuery (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:61:30)
    at async GoogleAdsAPIService.getCampaignData (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:202:30)
    at async POST (webpack-internal:///(rsc)/./src/app/api/automated/google-ads-daily-collection/route.ts:105:39)
    at async /Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/macbook/piotr/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/macbook/piotr/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/macbook/piotr/node_modules/next/dist/server/lib/start-server.js:141:13) {
  config: {
    retry: true,
    retryConfig: {
      httpMethodsToRetry: [Array],
      currentRetryAttempt: 0,
      retry: 3,
      noResponseRetries: 2,
      retryDelayMultiplier: 2,
      timeOfFirstRequest: 1759233776816,
      totalTimeout: 9007199254740991,
      maxRetryDelay: 9007199254740991,
      statusCodesToRetry: [Array]
    },
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      'x-goog-api-client': 'gl-node/20.18.0'
    },
    paramsSerializer: [Function: paramsSerializer],
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    validateStatus: [Function: validateStatus],
    responseType: 'unknown',
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      retry: true,
      retryConfig: [Object],
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      headers: [Object],
      paramsSerializer: [Function: paramsSerializer],
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      validateStatus: [Function: validateStatus],
      responseType: 'unknown',
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: { error: 'invalid_grant', error_description: 'Bad Request' },
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
      'content-encoding': 'gzip',
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 30 Sep 2025 12:02:56 GMT',
      expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
      pragma: 'no-cache',
      server: 'scaffolding on HTTPServer2',
      'transfer-encoding': 'chunked',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 400,
    statusText: 'Bad Request',
    request: { responseURL: 'https://oauth2.googleapis.com/token' }
  },
  error: undefined,
  status: 400,
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}
❌ Attempt 1 failed for Sandra SPA Karpacz: GaxiosError: invalid_grant
    at Gaxios._request (webpack-internal:///(rsc)/./node_modules/gaxios/build/src/gaxios.js:142:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async OAuth2Client.refreshTokenNoCache (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:212:19)
    at async OAuth2Client.refreshAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:247:19)
    at async OAuth2Client.getAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:276:23)
    at async Customer.getAccessToken (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/service.js:76:27)
    at async Customer.useStreamToImitateRegularSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:194:29)
    at async Customer.paginatedSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:157:34)
    at async Customer.querier (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:268:53)
    at async Customer.query (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:26:30)
    at async GoogleAdsAPIService.executeQuery (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:61:30)
    at async GoogleAdsAPIService.getCampaignData (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:202:30)
    at async POST (webpack-internal:///(rsc)/./src/app/api/automated/google-ads-daily-collection/route.ts:105:39)
    at async /Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/macbook/piotr/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/macbook/piotr/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/macbook/piotr/node_modules/next/dist/server/lib/start-server.js:141:13) {
  config: {
    retry: true,
    retryConfig: {
      httpMethodsToRetry: [Array],
      currentRetryAttempt: 0,
      retry: 3,
      noResponseRetries: 2,
      retryDelayMultiplier: 2,
      timeOfFirstRequest: 1759233776816,
      totalTimeout: 9007199254740991,
      maxRetryDelay: 9007199254740991,
      statusCodesToRetry: [Array]
    },
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      'x-goog-api-client': 'gl-node/20.18.0'
    },
    paramsSerializer: [Function: paramsSerializer],
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    validateStatus: [Function: validateStatus],
    responseType: 'unknown',
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      retry: true,
      retryConfig: [Object],
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      headers: [Object],
      paramsSerializer: [Function: paramsSerializer],
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      validateStatus: [Function: validateStatus],
      responseType: 'unknown',
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: { error: 'invalid_grant', error_description: 'Bad Request' },
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
      'content-encoding': 'gzip',
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 30 Sep 2025 12:02:56 GMT',
      expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
      pragma: 'no-cache',
      server: 'scaffolding on HTTPServer2',
      'transfer-encoding': 'chunked',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 400,
    statusText: 'Bad Request',
    request: { responseURL: 'https://oauth2.googleapis.com/token' }
  },
  error: undefined,
  status: 400,
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}

📝 Processing Google Ads: Sandra SPA Karpacz (attempt 2)
[INFO] 🏢 Using manager customer ID: 293-100-0497
[INFO] 🔧 Creating Google Ads customer instance: {
  customerId: '859-901-9750',
  hasRefreshToken: true,
  hasManagerId: true
}
[INFO] 📊 Fetching Google Ads campaign data from 2025-09-28 to 2025-09-28
[INFO] 📊 Executing Google Ads query
[ERROR] ❌ Error executing Google Ads query: GaxiosError: invalid_grant
    at Gaxios._request (webpack-internal:///(rsc)/./node_modules/gaxios/build/src/gaxios.js:142:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async OAuth2Client.refreshTokenNoCache (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:212:19)
    at async OAuth2Client.refreshAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:247:19)
    at async OAuth2Client.getAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:276:23)
    at async Customer.getAccessToken (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/service.js:76:27)
    at async Customer.useStreamToImitateRegularSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:194:29)
    at async Customer.paginatedSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:157:34)
    at async Customer.querier (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:268:53)
    at async Customer.query (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:26:30)
    at async GoogleAdsAPIService.executeQuery (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:61:30)
    at async GoogleAdsAPIService.getCampaignData (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:202:30)
    at async POST (webpack-internal:///(rsc)/./src/app/api/automated/google-ads-daily-collection/route.ts:105:39)
    at async /Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/macbook/piotr/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/macbook/piotr/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/macbook/piotr/node_modules/next/dist/server/lib/start-server.js:141:13) {
  config: {
    retry: true,
    retryConfig: {
      httpMethodsToRetry: [Array],
      currentRetryAttempt: 0,
      retry: 3,
      noResponseRetries: 2,
      retryDelayMultiplier: 2,
      timeOfFirstRequest: 1759233778881,
      totalTimeout: 9007199254740991,
      maxRetryDelay: 9007199254740991,
      statusCodesToRetry: [Array]
    },
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      'x-goog-api-client': 'gl-node/20.18.0'
    },
    paramsSerializer: [Function: paramsSerializer],
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    validateStatus: [Function: validateStatus],
    responseType: 'unknown',
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      retry: true,
      retryConfig: [Object],
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      headers: [Object],
      paramsSerializer: [Function: paramsSerializer],
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      validateStatus: [Function: validateStatus],
      responseType: 'unknown',
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: { error: 'invalid_grant', error_description: 'Bad Request' },
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
      'content-encoding': 'gzip',
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 30 Sep 2025 12:02:58 GMT',
      expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
      pragma: 'no-cache',
      server: 'scaffolding on HTTPServer2',
      'transfer-encoding': 'chunked',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 400,
    statusText: 'Bad Request',
    request: { responseURL: 'https://oauth2.googleapis.com/token' }
  },
  error: undefined,
  status: 400,
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}
[ERROR] ❌ Error fetching Google Ads campaign data: GaxiosError: invalid_grant
    at Gaxios._request (webpack-internal:///(rsc)/./node_modules/gaxios/build/src/gaxios.js:142:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async OAuth2Client.refreshTokenNoCache (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:212:19)
    at async OAuth2Client.refreshAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:247:19)
    at async OAuth2Client.getAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:276:23)
    at async Customer.getAccessToken (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/service.js:76:27)
    at async Customer.useStreamToImitateRegularSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:194:29)
    at async Customer.paginatedSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:157:34)
    at async Customer.querier (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:268:53)
    at async Customer.query (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:26:30)
    at async GoogleAdsAPIService.executeQuery (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:61:30)
    at async GoogleAdsAPIService.getCampaignData (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:202:30)
    at async POST (webpack-internal:///(rsc)/./src/app/api/automated/google-ads-daily-collection/route.ts:105:39)
    at async /Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/macbook/piotr/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/macbook/piotr/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/macbook/piotr/node_modules/next/dist/server/lib/start-server.js:141:13) {
  config: {
    retry: true,
    retryConfig: {
      httpMethodsToRetry: [Array],
      currentRetryAttempt: 0,
      retry: 3,
      noResponseRetries: 2,
      retryDelayMultiplier: 2,
      timeOfFirstRequest: 1759233778881,
      totalTimeout: 9007199254740991,
      maxRetryDelay: 9007199254740991,
      statusCodesToRetry: [Array]
    },
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      'x-goog-api-client': 'gl-node/20.18.0'
    },
    paramsSerializer: [Function: paramsSerializer],
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    validateStatus: [Function: validateStatus],
    responseType: 'unknown',
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      retry: true,
      retryConfig: [Object],
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      headers: [Object],
      paramsSerializer: [Function: paramsSerializer],
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      validateStatus: [Function: validateStatus],
      responseType: 'unknown',
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: { error: 'invalid_grant', error_description: 'Bad Request' },
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
      'content-encoding': 'gzip',
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 30 Sep 2025 12:02:58 GMT',
      expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
      pragma: 'no-cache',
      server: 'scaffolding on HTTPServer2',
      'transfer-encoding': 'chunked',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 400,
    statusText: 'Bad Request',
    request: { responseURL: 'https://oauth2.googleapis.com/token' }
  },
  error: undefined,
  status: 400,
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}
❌ Attempt 2 failed for Sandra SPA Karpacz: GaxiosError: invalid_grant
    at Gaxios._request (webpack-internal:///(rsc)/./node_modules/gaxios/build/src/gaxios.js:142:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async OAuth2Client.refreshTokenNoCache (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:212:19)
    at async OAuth2Client.refreshAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:247:19)
    at async OAuth2Client.getAccessTokenAsync (webpack-internal:///(rsc)/./node_modules/google-auth-library/build/src/auth/oauth2client.js:276:23)
    at async Customer.getAccessToken (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/service.js:76:27)
    at async Customer.useStreamToImitateRegularSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:194:29)
    at async Customer.paginatedSearch (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:157:34)
    at async Customer.querier (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:268:53)
    at async Customer.query (webpack-internal:///(rsc)/./node_modules/google-ads-api/build/src/customer.js:26:30)
    at async GoogleAdsAPIService.executeQuery (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:61:30)
    at async GoogleAdsAPIService.getCampaignData (webpack-internal:///(rsc)/./src/lib/google-ads-api.ts:202:30)
    at async POST (webpack-internal:///(rsc)/./src/app/api/automated/google-ads-daily-collection/route.ts:105:39)
    at async /Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/macbook/piotr/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/macbook/piotr/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/macbook/piotr/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/macbook/piotr/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/macbook/piotr/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/macbook/piotr/node_modules/next/dist/server/lib/start-server.js:141:13) {
  config: {
    retry: true,
    retryConfig: {
      httpMethodsToRetry: [Array],
      currentRetryAttempt: 0,
      retry: 3,
      noResponseRetries: 2,
      retryDelayMultiplier: 2,
      timeOfFirstRequest: 1759233778881,
      totalTimeout: 9007199254740991,
      maxRetryDelay: 9007199254740991,
      statusCodesToRetry: [Array]
    },
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      'x-goog-api-client': 'gl-node/20.18.0'
    },
    paramsSerializer: [Function: paramsSerializer],
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    validateStatus: [Function: validateStatus],
    responseType: 'unknown',
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      retry: true,
      retryConfig: [Object],
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      headers: [Object],
      paramsSerializer: [Function: paramsSerializer],
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      validateStatus: [Function: validateStatus],
      responseType: 'unknown',
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: { error: 'invalid_grant', error_description: 'Bad Request' },
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
      'content-encoding': 'gzip',
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 30 Sep 2025 12:02:58 GMT',
      expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
      pragma: 'no-cache',
      server: 'scaffolding on HTTPServer2',
      'transfer-encoding': 'chunked',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 400,
    statusText: 'Bad Request',
    request: { responseURL: 'https://oauth2.googleapis.com/token' }
  },
  error: undefined,
  status: 400,
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}
