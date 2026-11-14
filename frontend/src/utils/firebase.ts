import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "memora-ai-f0e2e.firebaseapp.com",
  projectId: "memora-ai-f0e2e",
  storageBucket: "memora-ai-f0e2e.firebasestorage.app",
  messagingSenderId: "417375179563",
  appId: "1:417375179563:web:e0ae52bfa630198153ab6e",
  measurementId: "G-CZ8NDC2X2V",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Create Firebase Authentication and Google provider : Use auth and provider with signInWithPopup()
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
