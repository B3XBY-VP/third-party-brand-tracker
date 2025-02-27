/* firebaseSync.js */

// 1. Import Firebase modules from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-analytics.js";
import {
  getFirestore,
  serverTimestamp,
  arrayUnion,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

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

// 3. Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);

// 4. Expose `db` and `auth` globally for use in other modules if needed
window.db = db;
window.auth = auth;

/**
 * Logs version history to Firestore by appending a new entry to `editHistory`.
 * @param {string} campaignId - The Firestore document ID of the campaign.
 * @param {string} editor - Name or ID of the user who edited the campaign.
 * @param {object} changes - An object of changed fields, mapping `fieldName` to `"oldValue → newValue"`.
 */
async function saveVersionHistory(campaignId, editor, changes) {
  try {
    const campaignRef = doc(db, "campaigns", campaignId);

    // Append a new edit record to the `editHistory` array
    await updateDoc(campaignRef, {
      editHistory: arrayUnion({
        editor: editor,
        timestamp: serverTimestamp(),  // Firestore server time
        changes: changes
      })
    });

    console.log("Version history saved!");
  } catch (error) {
    console.error("Error saving version history: ", error);
  }
}

/**
 * Updates a campaign document in Firestore and logs changes to version history.
 * @param {string} campaignId - The Firestore document ID of the campaign.
 * @param {object} newData - Key-value pairs of updated fields (e.g., { title: "New Title" }).
 * @param {string} editor - Name or ID of the user making the update.
 */
async function updateCampaign(campaignId, newData, editor) {
  try {
    const campaignRef = doc(db, "campaigns", campaignId);
    const campaignSnap = await getDoc(campaignRef);

    if (campaignSnap.exists()) {
      const oldData = campaignSnap.data();
      let changes = {};

      // Compare old vs. new data to see what changed
      Object.keys(newData).forEach((key) => {
        if (oldData[key] !== newData[key]) {
          changes[key] = `${oldData[key]} → ${newData[key]}`;
        }
      });

      // If there are changes, log them to version history
      if (Object.keys(changes).length > 0) {
        await saveVersionHistory(campaignId, editor, changes);
      }

      // Update the campaign document with new data
      await updateDoc(campaignRef, newData);
      console.log("Campaign updated successfully!");
    } else {
      console.log("No such campaign document found!");
    }
  } catch (error) {
    console.error("Error updating campaign: ", error);
  }
}

// 5. Export everything you need elsewhere
export { db, auth, saveVersionHistory, updateCampaign };
