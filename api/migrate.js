/* global process */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { supabaseAdmin } from './supabase-admin.js';

export const maxDuration = 60; // 60s Vercel timeout allowance

export default async function handler(req, res) {
  try {
    if (!getApps().length) {
      const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!saRaw) {
        return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT is missing in environment variables' });
      }
      const serviceAccount = JSON.parse(saRaw);
      initializeApp({ credential: cert(serviceAccount) });
    }

    const auth = getAuth();
    const db = getFirestore();

    // 1. Fetch all users from Firebase Auth to map uid -> email
    const uidToEmailMap = {};
    try {
      let pageToken = undefined;
      do {
        const listUsersResult = await auth.listUsers(1000, pageToken);
        listUsersResult.users.forEach((userRecord) => {
          if (userRecord.email) {
            uidToEmailMap[userRecord.uid] = userRecord.email;
          }
        });
        pageToken = listUsersResult.pageToken;
      } while (pageToken);
    } catch (authErr) {
      console.warn('Failed to list Firebase Auth users:', authErr.message);
    }

    // 2. Fetch all user documents under artifacts/quiz-lab-pro/users
    const usersColRef = db.collection('artifacts').doc('quiz-lab-pro').collection('users');
    const userDocs = await usersColRef.listDocuments();

    const results = [];
    let totalModulesCount = 0;

    for (const userDoc of userDocs) {
      const uid = userDoc.id;
      const email = uidToEmailMap[uid] || null;

      // Migrate user settings / Gemini keys if present
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
        console.warn('Failed to migrate api key for', uid, keyErr.message);
      }

      // Fetch and migrate all modules for this user
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

        // Save module under both the Firebase UID AND the user email
        // This ensures the user sees their modules whether matching by email or UID
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
    console.error('Migration fatal error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
