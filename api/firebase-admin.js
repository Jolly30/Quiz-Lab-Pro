/* global process */

let db = null;

async function initFirestore() {
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

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

    try {
      db = getFirestore();
    } catch {
      // Firestore not available
    }
  } catch (err) {
    console.warn('firebase-admin not available:', err.message);
  }
}

// Initialize on module load
await initFirestore();

export { db };
