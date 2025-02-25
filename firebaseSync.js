
/* firebaseSync.js */

// 1. Import Firebase modules from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-analytics.js";
// IMPORTANT: Firestore import instead of Realtime Database
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// 2. Initialize Firebase with your project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAsagt_nX44rYWCV7OC3fc8mASQJAIcM6w",
  authDomain: "third-party-brand-tracke-7009a.firebaseapp.com",
  projectId: "third-party-brand-tracke-7009a",
  storageBucket: "third-party-brand-tracke-7009a.firebasestorage.app",
  messagingSenderId: "994904948864",
  appId: "1:994904948864:web:a84513b825ab2501872665",
  measurementId: "G-8FX9KZK05Y"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// Now we get Firestore instead of Realtime Database
const db = getFirestore(app);

// 3. Expose `db` globally (optional)
window.db = db;

// 4. If you had any Firestore-specific logic, you could add it here.
//    For example, listening to a "campaigns" collection in Firestore or 
//    writing documents to Firestore.
