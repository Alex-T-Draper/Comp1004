// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyA2hu5W2sE0sjkuqZ0Utrd5fQVIRX9uwEM",
    authDomain: "comp1004-project.firebaseapp.com",
    databaseURL: "https://comp1004-project-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "comp1004-project",
    storageBucket: "comp1004-project.appspot.com",
    messagingSenderId: "200709675961",
    appId: "1:200709675961:web:cb2b49b26a0f94e7e37468",
    measurementId: "G-PPMT9B4C04"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);


// Export app and analytics if needed elsewhere
export { app, db, auth, storage, analytics };