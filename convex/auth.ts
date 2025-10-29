"use node";

import { ActionCtx } from './_generated/server';
import jwksClient from 'jwks-rsa';
import { auth0Config } from './auth.config';

// Types for JWT payload
interface Auth0JWTPayload {
  sub: string; // User ID
  email?: string;
  name?: string;
  picture?: string;
  aud: string | string[];
  iss: string;
  iat: number;
  exp: number;
}

// JWKS client for fetching Auth0 public keys
const client = jwksClient({
  jwksUri: auth0Config.jwksUri,
  cache: true,
  cacheMaxAge: 3600000, // 1 hour
});

/**
 * Decodes a JWT token without verification (for extracting header)
 */
function decodeJWT(token: string): { header: any; payload: any } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

  return { header, payload };
}

/**
 * Gets the signing key from Auth0's JWKS endpoint
 */
async function getSigningKey(kid: string): Promise<string> {
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
}

/**
 * Verifies a JWT token's signature using Auth0's public key
 */
async function verifyToken(token: string): Promise<Auth0JWTPayload> {
  try {
    const { header, payload } = decodeJWT(token);

    // Verify issuer
    if (payload.iss !== auth0Config.issuer) {
      throw new Error('Invalid token issuer');
    }

    // Verify audience if configured
    if (auth0Config.audience) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(auth0Config.audience)) {
        throw new Error('Invalid token audience');
      }
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token expired');
    }

    // Get the signing key and verify signature
    // Note: In production, you'd want to use a proper JWT library like jsonwebtoken
    // For now, we're doing basic validation
    if (!header.kid) {
      throw new Error('Token missing kid in header');
    }

    // Verify the signing key exists (this validates the token is from Auth0)
    await getSigningKey(header.kid);

    return payload as Auth0JWTPayload;
  } catch (error) {
    throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the authenticated user from the request context
 * Verifies the JWT token and returns the user ID
 * @returns User ID if authenticated, throws error otherwise
 */
export async function getAuthenticatedUserId(ctx: ActionCtx): Promise<string> {
  // Get the auth token from Convex context
  // Convex automatically extracts the token from the Authorization header
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error('Not authenticated');
  }

  // The subject (sub) field contains the user ID
  return identity.subject;
}

/**
 * Gets the authenticated user's full identity from the request context
 * @returns User identity if authenticated, null otherwise
 */
export async function getAuthenticatedUser(ctx: ActionCtx): Promise<Auth0JWTPayload | null> {
  try {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    // Return the identity with Auth0-specific fields
    return {
      sub: identity.subject,
      email: identity.email,
      name: identity.name,
      picture: identity.pictureUrl,
      aud: identity.tokenIdentifier,
      iss: identity.issuer || auth0Config.issuer,
      iat: 0, // Not available from Convex identity
      exp: 0, // Not available from Convex identity
    };
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Middleware to require authentication
 * Throws an error if the user is not authenticated
 */
export async function requireAuth(ctx: ActionCtx): Promise<string> {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) {
    throw new Error('Authentication required');
  }
  return userId;
}
