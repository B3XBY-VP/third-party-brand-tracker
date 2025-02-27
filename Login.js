// login.js
import { auth } from "./firebaseSync.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  
  try {
    // Attempt to sign in with email and password
    await signInWithEmailAndPassword(auth, email, password);
    // On successful login, redirect to the Admin Panel
    window.location.href = "index.html";
  } catch (error) {
    console.error("Login error:", error);
    alert("Login failed. Please check your email and password.");
  }
});
