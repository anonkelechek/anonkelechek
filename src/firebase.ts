import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCuPbeywUqxB8wlgQ_eIK0vfQAzqSBmmxw",
  authDomain: "kmitbook.firebaseapp.com",
  projectId: "kmitbook",
  storageBucket: "kmitbook.firebasestorage.app",
  messagingSenderId: "86562227743",
  appId: "1:86562227743:web:c639993c29b22d0150772a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
