import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "evalu8smart2026",
  appId: "1:352780138083:web:ba75600ed24719c03c2a56",
  storageBucket: "evalu8smart2026.firebasestorage.app",
  apiKey: "AIzaSyDHT9DXTmO7DnrTqpuD0af7KpGdtzII2zU",
  authDomain: "evalu8smart2026.firebaseapp.com",
  messagingSenderId: "352780138083"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
