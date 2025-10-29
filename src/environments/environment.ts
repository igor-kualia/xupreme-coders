export const environment = {
  production: false,
  convex: {
    url: 'https://hallowed-squirrel-142.convex.cloud', // Fill in your Convex development deployment URL
  },
  auth0: {
    domain: 'dev-yjz445wxd3w30hb0.us.auth0.com', // e.g., 'your-tenant.auth0.com'
    clientId: 'ZnG3Xc9nJ4Pw4xIFvJR1lgLvF5nfgoIR',
    authorizationParams: {
      redirect_uri: 'http://localhost:4200/callback',
      audience: 'https://api.xupreme-coders.com', // Your custom Auth0 API identifier
      scope: 'openid profile email', // Explicitly set scopes
    },
  },
};
