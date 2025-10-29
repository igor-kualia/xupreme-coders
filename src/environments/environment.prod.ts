export const environment = {
  production: true,
  convex: {
    url: 'https://rugged-lark-476.convex.cloud', // Fill in your Convex production deployment URL
  },
  auth0: {
    domain: 'xupreme-coders.us.auth0.com', // e.g., 'your-tenant.auth0.com'
    clientId: 'wY6lePAnLpWo8SnnnzMZngUW0wibQAde',
    authorizationParams: {
      redirect_uri: 'https://xupreme-coders.com/callback', // Update with your production URL
      audience: 'https://api.xupreme-coders.com', // Your custom Auth0 API identifier
      scope: 'openid profile email', // Explicitly set scopes
    },
  },
};
