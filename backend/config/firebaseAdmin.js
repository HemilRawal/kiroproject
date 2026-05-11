const admin = require('firebase-admin');
const path = require('path');

// Make sure to download your Firebase Service Account JSON and place it in the same directory as this file
let serviceAccount;
try {
  serviceAccount = require('./firebase-service-account.json');
} catch (error) {
  console.warn('⚠️ firebase-service-account.json not found in config directory. Please add it to use Firebase Phone Auth.');
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = admin;
