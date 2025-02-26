/* firebaseSync.js */

// 1. Import Firebase modules from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// 2. Initialize Firebase with your project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAsagt_nX44rYWCV7OC3fc8mASQJAIcM6w",
  authDomain: "third-party-brand-tracke-7009a.firebaseapp.com",
  projectId: "third-party-brand-tracke-7009a",
  storageBucket: "third-party-brand-tracke-7009a.appspot.com",
  messagingSenderId: "994904948864",
  appId: "1:994904948864:web:a84513b825ab2501872665",
  measurementId: "G-8FX9KZK05Y"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 3. Initialize Firestore
const db = getFirestore(app);

// 4. Expose `db` globally for use in other modules
window.db = db;

// 5. Additional Firestore-specific logic (e.g., listeners, writes) can be added here.

export { db };
