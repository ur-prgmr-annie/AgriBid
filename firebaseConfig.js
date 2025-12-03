import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';


// Your web app's Firebase configuration
const firebaseConfig = {
 apiKey: "AIzaSyDc_h0euSOQGPpVLUl7W3RdOaNeu_esKdk",
  authDomain: "agribid-804c1.firebaseapp.com",
  projectId: "agribid-804c1",
  storageBucket: "agribid-804c1.firebasestorage.app",
  messagingSenderId: "436369523167",
  appId: "1:436369523167:web:9d7b8c67db995f058f846a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const firestore = getFirestore(app);