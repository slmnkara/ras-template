import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBIo1wcz6fxMfsZcvU6LOpdy2LYKzXlwqY",
    authDomain: "ras-template.firebaseapp.com",
    projectId: "ras-template",
    storageBucket: "ras-template.firebasestorage.app",
    messagingSenderId: "562531700620",
    appId: "1:562531700620:web:cfed4f70ac7405dda6d0a9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);