/* global process */
import { supabaseAdmin } from './supabase-admin.js';

export const maxDuration = 60; // 60s Vercel timeout allowance

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // 1. Dynamic import of firebase-admin for Vercel Node.js ESM compatibility
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');

    // 2. Parse service account credentials safely
    const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saRaw) {
      return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT environment variable is missing on Vercel.' });
    }

    let serviceAccount;
    try {
      if (saRaw.trim().startsWith('{')) {
        serviceAccount = JSON.parse(saRaw.trim());
      } else {
        const decoded = Buffer.from(saRaw.trim(), 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      }
    } catch (parseErr) {
      return res.status(500).json({ error: 'Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ' + parseErr.message });
    }

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }

    const auth = getAuth();
    const db = getFirestore();

    // 3. Map Firebase user IDs to their emails
    const uidToEmailMap = {};
    try {
      let pageToken = undefined;
      do {
        const listUsersResult = await auth.listUsers(1000, pageToken);
        listUsersResult.users.forEach((userRecord) => {
          if (userRecord.email) {
            uidToEmailMap[userRecord.uid] = userRecord.email.toLowerCase();
          }
        });
        pageToken = listUsersResult.pageToken;
      } while (pageToken);
    } catch (authErr) {
      console.warn('Firebase Auth listUsers warning:', authErr.message);
    }

    // 4. Fetch all user documents under artifacts/quiz-lab-pro/users
    const usersColRef = db.collection('artifacts').doc('quiz-lab-pro').collection('users');
    const userDocs = await usersColRef.listDocuments();

    const results = [];
    let totalModulesCount = 0;

    for (const userDoc of userDocs) {
      const uid = userDoc.id;
      const email = uidToEmailMap[uid] || null;

      // Migrate user's private Gemini API key if present
      try {
        const apiKeyDoc = await userDoc.collection('settings').doc('apiKeys').get();
        if (apiKeyDoc.exists && apiKeyDoc.data()?.geminiKey) {
          const geminiKey = apiKeyDoc.data().geminiKey;
          const targets = [uid, email].filter(Boolean);
          for (const targetId of targets) {
            await supabaseAdmin.from('user_settings').upsert({
              user_id: targetId,
              gemini_key: geminiKey,
              updated_at: Date.now()
            }, { onConflict: 'user_id' });
          }
        }
      } catch (keyErr) {
        console.warn('API key migration warning for uid ' + uid + ':', keyErr.message);
      }

      // Fetch all modules for this user
      const modulesCol = userDoc.collection('modules');
      const moduleDocs = await modulesCol.get();

      let userModulesMigrated = 0;
      for (const mDoc of moduleDocs.docs) {
        const data = mDoc.data();
        const displayName = data.displayName || data.name || mDoc.id;
        let content = data.content || data.questionsData || data.questions || [];
        if (typeof content !== 'string') {
          content = JSON.stringify(content);
        }
        const folderName = data.folderName || 'Saved Modules';
        const updatedAt = data.updatedAt || Date.now();

        // Save module for both UID and Email so it matches however the user logs in
        const targetIds = [email, uid].filter(Boolean);
        for (const targetId of targetIds) {
          await supabaseAdmin.from('modules').upsert({
            user_id: targetId,
            display_name: displayName,
            content: content,
            folder_name: folderName,
            updated_at: updatedAt
          }, { onConflict: 'user_id,display_name' });
        }

        userModulesMigrated++;
        totalModulesCount++;
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
      error: err.message || 'Unknown error occurred',
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
}
