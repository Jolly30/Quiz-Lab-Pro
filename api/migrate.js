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

    // 1. Get access token from Google
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
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // 2. Map Firebase UIDs to Emails via Identity Toolkit
    const uidToEmailMap = {};
    try {
      let nextPageToken = undefined;
      do {
        const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet?maxResults=1000${nextPageToken ? `&nextPageToken=${nextPageToken}` : ''}`;
        const usersRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
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
      console.warn('Identity Toolkit warning:', authErr.message);
    }

    // 3. Collection Group Query: Find all "modules" collections in Firestore across all users!
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const runQueryRes = await fetch(queryUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'modules', allDescendants: true }]
        }
      })
    });

    const queryData = await runQueryRes.json();
    if (!runQueryRes.ok) {
      return res.status(500).json({ error: 'Firestore runQuery error: ' + JSON.stringify(queryData) });
    }

    let totalMigrated = 0;
    const userSummary = {};

    for (const item of queryData) {
      if (!item.document || !item.document.name) continue;

      const docName = item.document.name;
      // Extract uid and docId from path: /users/{uid}/modules/{docId}
      const match = docName.match(/\/users\/([^/]+)\/modules\/([^/]+)/);
      if (!match) continue;

      const uid = match[1];
      const docId = match[2];
      const email = uidToEmailMap[uid] || null;

      const docData = parseFirestoreDoc(item.document.fields);
      const displayName = docData.displayName || docData.name || docId;
      let content = docData.content || docData.questionsData || docData.questions || [];
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }
      const folderName = docData.folderName || 'Saved Modules';
      const updatedAt = docData.updatedAt || Date.now();

      // Upsert module for both the Firebase UID AND the Email
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

      totalMigrated++;
      userSummary[email || uid] = (userSummary[email || uid] || 0) + 1;
    }

    // 4. Also migrate settings/apiKeys
    try {
      const settingsQueryRes = await fetch(queryUrl, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'settings', allDescendants: true }]
          }
        })
      });
      if (settingsQueryRes.ok) {
        const settingsData = await settingsQueryRes.json();
        for (const item of settingsData) {
          if (!item.document) continue;
          const match = item.document.name.match(/\/users\/([^/]+)\/settings\/apiKeys/);
          if (!match) continue;
          const uid = match[1];
          const email = uidToEmailMap[uid] || null;
          const sParsed = parseFirestoreDoc(item.document.fields);
          if (sParsed.geminiKey) {
            const targets = [uid, email].filter(Boolean);
            for (const tId of targets) {
              await supabaseAdmin.from('user_settings').upsert({
                user_id: tId,
                gemini_key: sParsed.geminiKey,
                updated_at: Date.now()
              }, { onConflict: 'user_id' });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Settings migration warning:', e.message);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully migrated ${totalMigrated} modules across ${Object.keys(userSummary).length} users from Firebase to Supabase!`,
      details: userSummary
    });

  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
