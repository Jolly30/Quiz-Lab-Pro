/* global process */
import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin.js';

export const maxDuration = 60; // 60s Vercel timeout allowance

function createGoogleServiceJwt(clientEmail, privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claims = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${claims}`);
  const signature = sign.sign(privateKey, 'base64url');
  return `${header}.${claims}.${signature}`;
}

function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(parseFirestoreValue);
  if ('mapValue' in val) return parseFirestoreDoc(val.mapValue?.fields || {});
  return null;
}

function parseFirestoreDoc(fields) {
  const result = {};
  for (const [k, v] of Object.entries(fields || {})) {
    result[k] = parseFirestoreValue(v);
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // 1. Parse FIREBASE_SERVICE_ACCOUNT credentials
    const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saRaw) {
      return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT is missing on Vercel.' });
    }

    let sa;
    try {
      if (saRaw.trim().startsWith('{')) {
        sa = JSON.parse(saRaw.trim());
      } else {
        sa = JSON.parse(Buffer.from(saRaw.trim(), 'base64').toString('utf8'));
      }
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse FIREBASE_SERVICE_ACCOUNT: ' + e.message });
    }

    const projectId = sa.project_id || sa.projectId;
    const clientEmail = sa.client_email || sa.clientEmail;
    let privateKey = sa.private_key || sa.privateKey;
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // 2. Exchange JWT for Google OAuth2 access token
    const jwt = createGoogleServiceJwt(clientEmail, privateKey);
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return res.status(500).json({ error: 'Failed to obtain Google token: ' + JSON.stringify(tokenJson) });
    }
    const accessToken = tokenJson.access_token;
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // 3. Map Firebase UIDs to Emails via Identity Toolkit API
    const uidToEmailMap = {};
    try {
      let nextPageToken = undefined;
      do {
        const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet?maxResults=1000${nextPageToken ? `&nextPageToken=${nextPageToken}` : ''}`;
        const usersRes = await fetch(url, { headers: authHeader });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          (usersData.users || []).forEach(u => {
            if (u.localId && u.email) {
              uidToEmailMap[u.localId] = u.email.toLowerCase();
            }
          });
          nextPageToken = usersData.nextPageToken;
        } else {
          break;
        }
      } while (nextPageToken);
    } catch (authErr) {
      console.warn('Identity Toolkit batchGet warning:', authErr.message);
    }

    // 4. List all users under artifacts/quiz-lab-pro/users from Firestore REST API
    const usersUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/quiz-lab-pro/users?pageSize=1000`;
    const usersRes = await fetch(usersUrl, { headers: authHeader });
    const usersData = await usersRes.json();

    const userDocs = usersData.documents || [];
    const results = [];
    let totalModulesCount = 0;

    for (const uDoc of userDocs) {
      // Document name looks like: projects/.../documents/artifacts/quiz-lab-pro/users/{uid}
      const parts = uDoc.name.split('/');
      const uid = parts[parts.length - 1];
      const email = uidToEmailMap[uid] || null;

      // Migrate user settings / Gemini keys if present
      try {
        const settingsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/quiz-lab-pro/users/${uid}/settings/apiKeys`;
        const sRes = await fetch(settingsUrl, { headers: authHeader });
        if (sRes.ok) {
          const sData = await sRes.json();
          const parsed = parseFirestoreDoc(sData.fields);
          if (parsed.geminiKey) {
            const targets = [uid, email].filter(Boolean);
            for (const tId of targets) {
              await supabaseAdmin.from('user_settings').upsert({
                user_id: tId,
                gemini_key: parsed.geminiKey,
                updated_at: Date.now()
              }, { onConflict: 'user_id' });
            }
          }
        }
      } catch (keyErr) {
        console.warn('API key check warning:', keyErr.message);
      }

      // Fetch all modules for this user
      const modulesUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/quiz-lab-pro/users/${uid}/modules?pageSize=1000`;
      const mRes = await fetch(modulesUrl, { headers: authHeader });
      let userModulesMigrated = 0;

      if (mRes.ok) {
        const mData = await mRes.json();
        const mDocs = mData.documents || [];

        for (const modDoc of mDocs) {
          const docId = modDoc.name.split('/').pop();
          const docData = parseFirestoreDoc(modDoc.fields);
          const displayName = docData.displayName || docData.name || docId;
          let content = docData.content || docData.questionsData || docData.questions || [];
          if (typeof content !== 'string') {
            content = JSON.stringify(content);
          }
          const folderName = docData.folderName || 'Saved Modules';
          const updatedAt = docData.updatedAt || Date.now();

          // Save module under both the UID and the Email
          const targetIds = [email, uid].filter(Boolean);
          for (const tId of targetIds) {
            await supabaseAdmin.from('modules').upsert({
              user_id: tId,
              display_name: displayName,
              content: content,
              folder_name: folderName,
              updated_at: updatedAt
            }, { onConflict: 'user_id,display_name' });
          }

          userModulesMigrated++;
          totalModulesCount++;
        }
      }

      results.push({
        uid,
        email,
        modulesMigrated: userModulesMigrated
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully migrated ${totalModulesCount} modules across ${userDocs.length} users from Firebase to Supabase!`,
      details: results
    });

  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
