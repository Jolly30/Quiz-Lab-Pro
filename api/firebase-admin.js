/* global process */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin only once
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (serviceAccount.projectId) {
      initializeApp({ credential: cert(serviceAccount) });
    }
  } catch (err) {
    console.warn('Firebase Admin init failed:', err.message);
  }
}

// Export Firestore instance (may be null if init failed)
let db = null;
try {
  db = getFirestore();
} catch {
  // Firestore not available
}

export { db };
