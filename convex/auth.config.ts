import { AuthConfig } from "convex/server";

/**
 * Auth0 configuration for Convex backend
 *
 * IMPORTANT: Convex uses ID tokens, not access tokens!
 * - applicationID should be the Auth0 Client ID (for ID tokens)
 * - domain should be https://your-domain.auth0.com/
 */

export default {
  providers: [
    {
      domain: `https://${process.env["AUTH0_DOMAIN"] || "dev-yjz445wxd3w30hb0.us.auth0.com"}/`,
      applicationID: process.env["AUTH0_CLIENT_ID"] || "ZnG3Xc9nJ4Pw4xIFvJR1lgLvF5nfgoIR",
    },
  ],
} satisfies AuthConfig;

// Helper config object for use in auth.ts (for access tokens if needed)
export const auth0Config = {
  // Your Auth0 domain (e.g., 'your-tenant.auth0.com')
  domain: process.env["AUTH0_DOMAIN"] || "dev-yjz445wxd3w30hb0.us.auth0.com",

  // Your Auth0 API audience identifier (for access tokens)
  audience: process.env["AUTH0_AUDIENCE"] || "https://api.xupreme-coders.com",

  // JWKS URI for fetching Auth0 public keys
  get jwksUri() {
    return `https://${this.domain}/.well-known/jwks.json`;
  },

  // Issuer for JWT tokens
  get issuer() {
    return `https://${this.domain}/`;
  },
};
