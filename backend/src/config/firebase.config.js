const admin = require('firebase-admin');
const config = require('./index');
const logger = require('../utils/logger');

const firebaseConfig = {
  apiKey: config.firebase.apiKey,
  authDomain: config.firebase.authDomain,
  projectId: config.firebase.projectId,
  storageBucket: config.firebase.storageBucket,
  messagingSenderId: config.firebase.messagingSenderId,
  appId: config.firebase.appId,
};

// Initialize Firebase Admin (same config for all environments)
let firebaseInitialized = false;
try {
  if (config.firebase.projectId && config.firebase.privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail || `${config.firebase.projectId}@appspot.gserviceaccount.com`,
        privateKey: config.firebase.privateKey,
      }),
      databaseURL: `https://${config.firebase.projectId}.firebaseio.com`,
    });
    firebaseInitialized = true;
    logger.info('Firebase Admin initialized');
  } else {
    logger.warn('Firebase Admin SDK credentials missing — Firebase auth will not work. Set FIREBASE_PRIVATE_KEY and FIREBASE_PROJECT_ID in .env');
  }
} catch (error) {
  logger.error('Firebase initialization error', { error: error.message });
}

module.exports = {
  admin,
  firebaseConfig,
  firebaseInitialized
};