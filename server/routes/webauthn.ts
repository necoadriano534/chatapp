import { Router } from 'express';
import { db, users, webauthnCredentials } from '../db';
import { eq } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import logger from '../utils/logger';

const router = Router();

// WebAuthn configuration
const rpName = process.env.WEBAUTHN_RP_NAME || 'ChatApp';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

// Store challenges temporarily
// WARNING: In-memory storage is only suitable for development
// For production, use Redis or a database-backed session store
// to handle multiple server instances and persistence across restarts
const challenges = new Map<string, string>();

// Get registration options
router.get('/register-options', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;

    // Get existing credentials
    const existingCredentials = await db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, user.id));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as AuthenticatorTransport[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge
    challenges.set(user.id, options.challenge);

    res.json(options);
  } catch (error) {
    logger.error(`Failed to generate registration options: ${error}`, { module: 'WebAuthn' });
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// Verify registration
router.post('/register-verify', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const response: RegistrationResponseJSON = req.body;

    const expectedChallenge = challenges.get(user.id);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No challenge found' });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    // Store credential
    await db.insert(webauthnCredentials).values({
      userId: user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      transports: response.response.transports,
    });

    // Clear challenge
    challenges.delete(user.id);

    logger.success(`WebAuthn credential registered for user: ${user.email}`, { module: 'WebAuthn' });

    res.json({ verified: true });
  } catch (error) {
    logger.error(`Failed to verify registration: ${error}`, { module: 'WebAuthn' });
    res.status(500).json({ error: 'Failed to verify registration' });
  }
});

// Get authentication options
router.get('/authenticate-options', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email as string));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userCredentials = await db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, user.id));

    if (userCredentials.length === 0) {
      return res.status(400).json({ error: 'No credentials registered' });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as AuthenticatorTransport[] | undefined,
      })),
      userVerification: 'preferred',
    });

    // Store challenge
    challenges.set(user.id, options.challenge);

    res.json({ ...options, userId: user.id });
  } catch (error) {
    logger.error(`Failed to generate authentication options: ${error}`, { module: 'WebAuthn' });
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
});

// Verify authentication
router.post('/authenticate-verify', async (req, res) => {
  try {
    const { userId, response }: { userId: string; response: AuthenticationResponseJSON } = req.body;

    const expectedChallenge = challenges.get(userId);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No challenge found' });
    }

    const [credential] = await db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, response.id));

    if (!credential) {
      return res.status(400).json({ error: 'Credential not found' });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64'),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransport[] | undefined,
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    // Update counter
    await db
      .update(webauthnCredentials)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(webauthnCredentials.id, credential.id));

    // Clear challenge
    challenges.delete(userId);

    // Get user and generate token
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId));

    // Import generateToken here to avoid circular dependency
    const { generateToken } = await import('../middleware/auth');
    const token = generateToken(user.id);

    logger.success(`WebAuthn authentication successful for user: ${user.email}`, { module: 'WebAuthn' });

    res.json({
      verified: true,
      user,
      token,
    });
  } catch (error) {
    logger.error(`Failed to verify authentication: ${error}`, { module: 'WebAuthn' });
    res.status(500).json({ error: 'Failed to verify authentication' });
  }
});

// Get user's credentials
router.get('/credentials', authenticate, async (req: AuthRequest, res) => {
  try {
    const credentials = await db
      .select({
        id: webauthnCredentials.id,
        deviceType: webauthnCredentials.deviceType,
        createdAt: webauthnCredentials.createdAt,
      })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, req.user!.id));

    res.json(credentials);
  } catch (error) {
    logger.error(`Failed to get credentials: ${error}`, { module: 'WebAuthn' });
    res.status(500).json({ error: 'Failed to get credentials' });
  }
});

// Delete credential
router.delete('/credentials/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const [credential] = await db
      .delete(webauthnCredentials)
      .where(eq(webauthnCredentials.id, id))
      .returning();

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    logger.success(`WebAuthn credential deleted for user: ${req.user!.email}`, { module: 'WebAuthn' });

    res.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    logger.error(`Failed to delete credential: ${error}`, { module: 'WebAuthn' });
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

export default router;
