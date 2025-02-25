/* firebaseSync.js */

// 1. Import Firebase modules from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-analytics.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-database.js";

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
const db = getDatabase(app);

// 3. A guard to prevent infinite loops when syncing data from Firebase to localStorage
let isSyncingFromFirebase = false;

// 4. Listen for all campaign data from Firebase stored under the "campaigns" node.
//    Each key here is expected to match your localStorage keys like "campaigns_2023", etc.
const campaignsRef = ref(db, "campaigns");

onValue(campaignsRef, (snapshot) => {
  isSyncingFromFirebase = true; // Prevent feedback loops
  const allCampaigns = snapshot.val() || {};

  // Mirror each Firebase key to localStorage
  for (const storageKey in allCampaigns) {
    localStorage.setItem(storageKey, JSON.stringify(allCampaigns[storageKey]));
  }
  isSyncingFromFirebase = false;
});

// 5. Monkey-patch localStorage.setItem so that whenever your existing code writes
//    to localStorage (for keys like "campaigns_2025"), the changes are also pushed to Firebase.
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  // Call the original localStorage.setItem
  originalSetItem.apply(localStorage, [key, value]);

  // If not currently syncing from Firebase and the key is for campaigns, push to Firebase.
  if (!isSyncingFromFirebase && key.startsWith("campaigns_")) {
    try {
      const parsed = JSON.parse(value);
      // Update Firebase at the corresponding node, e.g., "campaigns/campaigns_2025"
      update(ref(db, `campaigns/${key}`), parsed || {});
    } catch (err) {
      console.error("Failed to sync data to Firebase:", err);
    }
  }
};
