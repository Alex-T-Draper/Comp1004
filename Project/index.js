import { db, storage } from './firebase-init.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { collection, query, where, getDocs, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut  } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Authentication state observer setup function

function onAuthStateChangedListener() {
    const auth = getAuth();
    const welcomeText = document.getElementById('welcomeText');
    const uploadButton = document.getElementById('openModalButton');
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in, show "Log Out" and hide "Log In" and "Sign Up"
            signInButton.style.display = 'none';
            signUpButton.style.display = 'none';
            signOutButton.style.display = 'inline-block';
            uploadButton.style.display = 'inline-block';
            welcomeText.textContent = `Welcome back: ${user.email}`;
        } else {
            // No user is signed in, show "Log In" and "Sign Up" and hide "Log Out"
            signInButton.style.display = 'inline-block';
            signUpButton.style.display = 'inline-block';
            signOutButton.style.display = 'none';
            uploadButton.style.display = 'none';
            welcomeText.textContent = '';
        }
    });
}

// Sign out function
function signOutUser() {
    const auth = getAuth();
    signOut(auth).then(() => {
        console.log('User signed out');
    }).catch((error) => {
        console.error('Sign out error', error);
    });
}

// ** SIGN IN AND SIGN UP **
// Function to open the sign-up modal
function openSignUpModal() {
    document.getElementById('signUpModal').style.display = 'block';
}

// Function to close the sign-up modal
function closeSignUpModal() {
    document.getElementById('signUpModal').style.display = 'none';
}

function closeSignInModal() {
    document.getElementById('signInModal').style.display = 'none';
}

// Function to display images by category
async function displayImagesByCategory(categoryName) {
     // Reference to the container in your HTML where the images will be displayed
     console.log(`Querying for .${categoryName}-images .image-gallery`);
     const categoryContainer = document.querySelector(`.${categoryName}-images`);
 
     // Check if the container exists
     if (!categoryContainer) {
         console.error(`The container for category "${categoryName}" does not exist.`);
         return;
     }
 
     // Clear out any existing content in the container
     categoryContainer.innerHTML = '';
 
     // Query Firestore for images in the specified category
     const imagesCollectionRef = collection(db, 'images');
     const q = query(imagesCollectionRef, where("category", "==", categoryName));
     const querySnapshot = await getDocs(q);
 
     // Loop through the documents returned by the query
     for (const docSnapshot of querySnapshot.docs) {
         const data = docSnapshot.data();
         const imageGridItem = document.createElement('div');
         imageGridItem.className = 'image-grid-item';
         imageGridItem.setAttribute('data-id', docSnapshot.id);
         imageGridItem.setAttribute('data-author', data.author);
         imageGridItem.setAttribute('data-category', data.category);
         imageGridItem.setAttribute('data-description', data.description);
 
         const img = document.createElement('img');
         img.src = data.url;
         img.alt = data.description || 'Image';
         imageGridItem.appendChild(img);
 
         const button = document.createElement('button');
         button.className = 'toggle-context';
         button.textContent = '▼';
         button.onclick = () => openImageContextModal(docSnapshot.id);
         imageGridItem.appendChild(button);
 
         categoryContainer.appendChild(imageGridItem);
     }
}

// Like and dislike button function
async function updateLikes(docId, userId, isLike) {
    const imageDocRef = doc(db, 'images', docId);
    const userReactionRef = doc(db, `images/${docId}/reactions`, userId);

    try {
        const transactionResult = await runTransaction(db, async (transaction) => {
            const imageDoc = await transaction.get(imageDocRef);
            const userReaction = await transaction.get(userReactionRef);
            if (!imageDoc.exists()) {
                throw new Error("Document does not exist!");
            }

            const data = imageDoc.data();
            let likes = data.likes;
            let dislikes = data.dislikes;
            let reactionData = userReaction.data() || { like: false, dislike: false };

            // Update the counts only if the user hasn't already reacted in this way
            if (isLike && !reactionData.like) {
                likes++; // Increment likes if the user is liking the image
                if (reactionData.dislike) {
                    dislikes--; // Decrement dislikes if the user previously disliked
                }
            } else if (!isLike && !reactionData.dislike) {
                dislikes++; // Increment dislikes if the user is disliking the image
                if (reactionData.like) {
                    likes--; // Decrement likes if the user previously liked
                }
            }

            // Update the user's reaction
            reactionData.like = isLike;
            reactionData.dislike = !isLike;

            transaction.update(imageDocRef, { likes, dislikes });
            transaction.set(userReactionRef, reactionData);

            return { likes, dislikes }; // This will be the result of the transaction
        });

        // Transaction is successful
        document.getElementById(`likes-count-${docId}`).textContent = transactionResult.likes;
        document.getElementById(`dislikes-count-${docId}`).textContent = transactionResult.dislikes;

        // After the transaction, update the button colors
        const likeButtonElement = document.getElementById(`like-button-${docId}`);
        const dislikeButtonElement = document.getElementById(`dislike-button-${docId}`);
        if (isLike) {
            likeButtonElement.classList.add('liked');
            dislikeButtonElement.classList.remove('disliked');
        } else {
            dislikeButtonElement.classList.add('disliked');
            likeButtonElement.classList.remove('liked');
        }
    } catch (error) {
        console.error("Transaction failed: ", error);
    }
}

// Function to open the image context modal
async function openImageContextModal(docId) {
    const contextModal = document.getElementById('imageContextModal');
    const contextContent = document.getElementById('imageContextContent');
    
    // Fetch the latest data for the image
    const imageDocRef = doc(db, 'images', docId);
    const imageDocSnap = await getDoc(imageDocRef);
    
    if (imageDocSnap.exists()) {
        const data = imageDocSnap.data();

        const dynamicContentHtml = `
            <h3>${data.imageName}</h3>
            <img src="${data.url}" alt="Image Preview" style="max-width: 100%;"><br>
            <p>Uploader: ${data.author}</p>
            <p>Category: ${data.category}</p>
            <p>Description: ${data.description}</p>
            <div>
                <span id="likes-count-${docId}">${data.likes || 0}</span>
                <button id="like-button-${docId}" aria-label="like"><i class="fa fa-thumbs-up"></i></button>
                <span id="dislikes-count-${docId}">${data.dislikes || 0}</span>
                <button id="dislike-button-${docId}" aria-label="dislike"><i class="fa fa-thumbs-down"></i></button>
            </div>
        `;

        contextContent.innerHTML = dynamicContentHtml;

        const likeButton = document.getElementById(`like-button-${docId}`);
        const dislikeButton = document.getElementById(`dislike-button-${docId}`);
        
        const auth = getAuth();
        const user = auth.currentUser;

        // Function to set button styles based on user's previous reactions
        const setUserReactionStyles = (like, dislike) => {
            if (like) {
                likeButton.classList.add('liked');
                dislikeButton.classList.remove('disliked');
            } else if (dislike) {
                dislikeButton.classList.add('disliked');
                likeButton.classList.remove('liked');
            } else {
                likeButton.classList.remove('liked');
                dislikeButton.classList.remove('disliked');
            }
        };

        // Check the user's reaction if logged in
        if (user) {
            const userReactionRef = doc(db, `images/${docId}/reactions`, user.uid);
            const userReactionSnap = await getDoc(userReactionRef);
            if (userReactionSnap.exists()) {
                const reactionData = userReactionSnap.data();
                setUserReactionStyles(reactionData.like, reactionData.dislike);
            } else {
                setUserReactionStyles(false, false);
            }
            likeButton.addEventListener('click', () => updateLikes(docId, user.uid, true));
            dislikeButton.addEventListener('click', () => updateLikes(docId, user.uid, false));
        } else {
            setUserReactionStyles(false, false); // Reset styles if no user is logged in
            likeButton.addEventListener('click', () => alert('You must log in to like or dislike images.'));
            dislikeButton.addEventListener('click', () => alert('You must log in to like or dislike images.'));
        }

        contextModal.style.display = 'block';
    } else {
        console.error('No such document!');
    }
}

// Close button function
function closeImageContextModal() {
    var contextModal = document.getElementById('imageContextModal');
    contextModal.style.display = 'none';
}

function highlightNavButton() {
    var sections = document.querySelectorAll('header h2');
    sections.forEach((section, index) => {
        var rect = section.getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
            var navButtons = document.querySelectorAll('.nav-btn');
            navButtons.forEach(button => button.classList.remove('active'));
            navButtons[index].classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    
    // Check the current user on initial load
    onAuthStateChangedListener();

    var modal = document.getElementById('uploadModal');
    var btn = document.getElementById('openModalButton');


    btn.onclick = function() {
        modal.style.display = "block";
    }

    document.getElementById('signOutButton').addEventListener('click', signOutUser);

    // Sign Up
    // Event listener for the Sign Up button to open the modal
    
    document.getElementById('signUpButton').addEventListener('click', function() {
        document.getElementById('signUpModal').style.display = 'block';
    });

    document.getElementById('signUpButton').addEventListener('click', openSignUpModal);

    // Event listener for the close button of the sign-up modal
    document.getElementById('closeSignUpModalButton').addEventListener('click', closeSignUpModal);

    // Event listener for the sign-up form submission
    document.getElementById('signUpForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting normally

    // Get email and password input values
    const email = document.getElementById('signUpEmail').value;
    const password = document.getElementById('signUpPassword').value;
    
    // Regex Check
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return; // Stop the function if the test fails
    }

    // Firebase authentication logic for signing up
    const auth = getAuth();
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Signed up successfully
            const user = userCredential.user;
            console.log('User created:', user.uid);
            // Close the modal and clear the form
            closeSignUpModal();
            document.getElementById('signUpForm').reset();
        })
        .catch((error) => {
            // Handle errors here
            const errorCode = error.code;
            const errorMessage = error.message;
            alert(`Error ${errorCode}: ${errorMessage}`);
        });
    });

    // Sign In

    // Set up event listeners for sign-in, sign-up, and sign-out
    document.getElementById('signInButton').addEventListener('click', function() {
        document.getElementById('signInModal').style.display = 'block';
    });

    // Event listener for the close button of the sign-up modal
    document.getElementById('closeSignInModalButton').addEventListener('click', closeSignInModal);
    
    document.getElementById('signInForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the form from submitting normally
    
        // Get email and password input values
        const email = document.getElementById('signInEmail').value;
        const password = document.getElementById('signInPassword').value;
    
        // Firebase authentication logic for signing in
        const auth = getAuth();
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed in successfully
                const user = userCredential.user;
                console.log('User signed in:', user.uid);
                // Optionally, close the modal and clear the form here
                document.getElementById('signInModal').style.display = 'none';
                document.getElementById('signInForm').reset();
                // Redirect or update UI as needed
            })
            .catch((error) => {
                // Handle errors here, such as incorrect email or password
                const errorCode = error.code;
                const errorMessage = error.message;
                alert(`Error ${errorCode}: ${errorMessage}`);
            });
    });

    document.getElementById('signOutButton').addEventListener('click', function() {
        signOutUser();
        alert("You have been signed out.")
    });

    // Upload Image
    document.getElementById('imageUpload').addEventListener('change', function(event) {
        var reader = new FileReader();
        reader.onload = function() {
            var output = document.getElementById('imagePreview');
            output.src = reader.result;
            output.style.display = 'block';
        };
        reader.readAsDataURL(event.target.files[0]);
    });

    // Upload Image Button Clicked
    document.getElementById('imageUploadForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Retrieve all form inputs
        const fileInput = document.getElementById('imageUpload');
        const imageNameInput = document.getElementById('imageName'); 
        const categoryInput = document.getElementById('imageCategory');
        const descriptionInput = document.getElementById('imageInfo');
        const authorInput = document.getElementById('authorName'); 
        
        // Retrieve the values
        const file = fileInput.files[0];
        const imageName = imageNameInput.value;
        const category = categoryInput.value;
        const description = descriptionInput.value;
        const author = authorInput.value;
    
        if (file) {
            try {
                const imageRef = storageRef(storage, `images/${file.name}`);
                const snapshot = await uploadBytes(imageRef, file);
                const url = await getDownloadURL(imageRef);
    
                const imagesCollectionRef = collection(db, 'images');
                const docRef = await addDoc(imagesCollectionRef, {
                    fileName: file.name,
                    imageName: imageName,
                    category: category,
                    description: description,
                    author: author,
                    likes: 0,
                    dislikes: 0,
                    url: url
                });
    
                console.log('Document written with ID: ', docRef.id);
                alert('Image uploaded successfully!');
    
                document.getElementById('imageUploadForm').reset();
                document.getElementById('imagePreview').style.display = 'none';
                // Update Images on page
                await displayImagesByCategory(category);
    
            } catch (error) {
                console.error('Error during the upload:', error);
                alert('An error occurred during the upload.');
            }
        } else {
            alert('Please select a file to upload.');
        }
    
        modal.style.display = "none";
    });

    // Cancel Button Clicked then reset all fields
    document.getElementById('cancelUpload').addEventListener('click', function() {
        document.getElementById('imageUploadForm').reset();
        var output = document.getElementById('imagePreview');
        output.style.display = 'none';
        output.src = '';
        modal.style.display = "none";
    });

    // When down arrow is pressed on image
    document.querySelectorAll('.toggle-context').forEach(function(button) {
        button.addEventListener('click', function() {
            var imageItem = button.closest('.image-grid-item');
            var imageSrc = imageItem.querySelector('img').src;
            var author = imageItem.getAttribute('data-author');
            var category = imageItem.getAttribute('data-category');
            var description = imageItem.getAttribute('data-description');

            var contentHtml = `<img src="${imageSrc}" alt="Image Preview" style="max-width: 100%;"><br>` +
                              `<p>Author: ${author}</p>` +
                              `<p>Category: ${category}</p>` +
                              `<p>${description}</p>`;
            openImageContextModal(contentHtml);
        });
    });

    // Navigation bar
    var navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            var targetId = button.getAttribute('data-target');
            var section = document.getElementById(targetId);
            section.scrollIntoView({ behavior: 'smooth' });

            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    window.addEventListener('scroll', function() {
        highlightNavButton();
    });

    highlightNavButton();

    const navBar = document.querySelector('.nav_bar');
    const offset = navBar.offsetTop;

    window.addEventListener('scroll', function() {
        if (window.pageYOffset >= offset) {
            navBar.classList.add('fixed');
        } else {
            navBar.classList.remove('fixed');
        }
    });
    
    // Function to close the image context modal
    function closeImageContextModal() {
        document.getElementById('imageContextModal').style.display = 'none';
    }

    // Function to close the upload modal
    function closeUploadModal() {
        document.getElementById('uploadModal').style.display = 'none';
    }

    // Add the click event listeners to the 'X' close buttons
    document.getElementById('closeImageContextButton').addEventListener('click', closeImageContextModal);
    document.getElementById('closeUploadModalButton').addEventListener('click', closeUploadModal);

    // Add the click event listener to close the modals if clicking outside of them
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('imageContextModal')) {
            closeImageContextModal();
        }
        if (event.target === document.getElementById('uploadModal')) {
            closeUploadModal();
        }
    });

    // Add the event listener for the escape key to close the modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            if (document.getElementById('imageContextModal').style.display === 'block') {
                closeImageContextModal();
            }
            if (document.getElementById('uploadModal').style.display === 'block') {
                closeUploadModal();
            }
        }
    });

    // Display images
    try {
        await displayImagesByCategory('food');
        await displayImagesByCategory('fashion');
        await displayImagesByCategory('sports');
        await displayImagesByCategory('informative');
        await displayImagesByCategory('funny');
        await displayImagesByCategory('history');
    } catch (error) {
        console.error("Error displaying images:", error);
    }
});