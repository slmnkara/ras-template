import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDQEVm6oMaiDLeO_3HiofKLGGLGulQWxog",
    authDomain: "binampratik.firebaseapp.com",
    projectId: "binampratik",
    storageBucket: "binampratik.firebasestorage.app",
    messagingSenderId: "296772351316",
    appId: "1:296772351316:web:409cc4bbc47b46e76644c1",
    measurementId: "G-JDVEFHGGB8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);