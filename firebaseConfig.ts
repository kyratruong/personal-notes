import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB2QfDadKZF9AtGtOQGeXY46BoDaWEtqVQ',
  authDomain: 'mas-classes.firebaseapp.com',
  projectId: 'mas-classes',
  storageBucket: 'mas-classes.firebasestorage.app',
  messagingSenderId: '1014309137607',
  appId: '1:1014309137607:web:f15a7443f17589cf54e2e2',
  measurementId: 'G-6J383695DZ',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
