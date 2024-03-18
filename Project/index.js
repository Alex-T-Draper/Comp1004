import { db, storage } from './firebase-init.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { collection, query, where, getDocs, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";


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

// Comment Function
async function displayComments(docId) {
    const commentsContainer = document.getElementById(`comments-container-${docId}`);
    const commentsRef = collection(db, `images/${docId}/comments`);
    const q = query(commentsRef, orderBy("timestamp", "asc")); // Order by timestamp in ascending order
    const querySnapshot = await getDocs(q);

    // Clear previous comments
    commentsContainer.innerHTML = '';
  
    querySnapshot.forEach((doc) => {
        const commentData = doc.data();
        const commentElement = document.createElement('p');
        commentElement.textContent = `${commentData.user}: ${commentData.text}`;
        commentsContainer.appendChild(commentElement);
    });
}

async function submitComment(docId) {
    const commentInput = document.getElementById(`comment-input-${docId}`);
    const commentText = commentInput.value.trim();
    const auth = getAuth();
    const user = auth.currentUser;
  
    if (commentText === '') {
      alert('Comment cannot be empty.');
      return;
    }
  
    if (!user) {
      alert('You must be logged in to post comments.');
      return;
    }
  
    try {
        const commentsRef = collection(db, `images/${docId}/comments`);
        await addDoc(commentsRef, {
            text: commentText,
            user: user.email, // Or another identifier like user.uid
            timestamp: serverTimestamp() // Firebase server timestamp
        });
  
      // Clear the comment input field
      commentInput.value = '';
  
      // Refresh the comments section to include the new comment
      await displayComments(docId);
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment.');
    }
  }

// Function to open the image context modal with relevent data
async function openImageContextModal(docId) {
    const contextModal = document.getElementById('imageContextModal');
    const contextContent = document.getElementById('imageContextContent');

    // Fetch the latest data for the image
    const imageDocRef = doc(db, 'images', docId);
    const imageDocSnap = await getDoc(imageDocRef);

    if (imageDocSnap.exists()) {
        const data = imageDocSnap.data();
        const uploadDate = new Date(data.uploadDate);

        const dynamicContentHtml = `
            <h3>${data.imageName}</h3>
            <h4>${data.category}</h4>
            <img src="${data.url}" alt="Image Preview" style="max-width: 100%; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <p>Uploaded by: ${data.author}</p>
                <p>Uploaded: ${uploadDate.toLocaleDateString()}</p>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                <p>Description: ${data.description}</p>
                <div class="reaction-container">
                    <button id="like-button-${docId}" class="reaction-button" aria-label="like">
                        <span class="material-icons">thumb_up</span>
                        <span id="likes-count-${docId}">${data.likes || 0}</span>
                    </button>
                    <button id="dislike-button-${docId}" class="reaction-button" aria-label="dislike">
                        <span class="material-icons">thumb_down</span>
                        <span id="dislikes-count-${docId}">${data.dislikes || 0}</span>
                    </button>
                </div>
            </div>
            <h5>Comments</h5>
            <div id="comments-container-${docId}" style="max-height: 150px; overflow-y: auto;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <textarea id="comment-input-${docId}" placeholder="Add a comment..." style="width: 85%; height: 50px;"></textarea>
                <button id="post-comment-button-${docId}" style="width: 100px;">Post Comment</button>
            </div>
        `;

        contextContent.innerHTML = dynamicContentHtml;

        // Display comments for the image
        await displayComments(docId);

        // Add event listener to the post comment button
        document.getElementById(`post-comment-button-${docId}`).addEventListener('click', () => submitComment(docId));

        // Add event listener for the 'Enter' key in the comment input
        document.getElementById(`comment-input-${docId}`).addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                submitComment(docId);
            }
        });

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

// Function to close the sign-up modal
function closeSignUpModal() {
    document.getElementById('signUpModal').style.display = 'none';
}

// Function to close the sign-in modal
function closeSignInModal() {
    document.getElementById('signInModal').style.display = 'none';
}

// Function to close the image context modal
function closeImageContextModal() {
    document.getElementById('imageContextModal').style.display = 'none';
}

// Function to close the upload modal
function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
}

// Function to highlight navigation bar
function highlightNavButton() {
    const navbarHeight = document.querySelector('.nav_bar').offsetHeight;
    const scrollPosition = window.pageYOffset;
    const navButtons = document.querySelectorAll('.nav-btn');

    // Check if the user has scrolled to the top of the page or near the top
    if (scrollPosition <= navbarHeight) {
        navButtons.forEach(button => button.classList.remove('active'));
        document.getElementById('aboutButton').classList.add('active');
        return;
    }

    // Assume no section is active initially
    let activeSectionFound = false;

    navButtons.forEach(button => {
        const targetId = button.getAttribute('data-target');
        const section = document.getElementById(targetId);

        if (section) {
            const sectionTop = section.offsetTop - navbarHeight;
            const sectionBottom = sectionTop + section.offsetHeight;

            if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                button.classList.add('active');
                activeSectionFound = true;
            } else {
                button.classList.remove('active');
            }
        }
    });
}

// Function to scroll when navigation bar is clicked
function scrollToSection(event) {
    // Immediately set the clicked button as active
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const targetId = event.currentTarget.getAttribute('data-target');
    const section = document.getElementById(targetId);
    
    if (section) {
        const yOffset = -document.querySelector('.nav_bar').offsetHeight;
        const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

// Function to make navigation bar stick to top when scrolling down
function makeNavbarSticky() {
    const navBar = document.querySelector('.nav_bar');
    const stickyOffset = navBar.offsetTop; 

    if (window.pageYOffset > stickyOffset) {
        navBar.classList.add('sticky');
    } else {
        navBar.classList.remove('sticky');
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    onAuthStateChangedListener();

    // Modal triggers
    document.getElementById('openModalButton').onclick = () => {
        document.getElementById('uploadModal').style.display = "block";
    };

    // User action event listeners
    document.getElementById('signUpButton').addEventListener('click', () => {
        document.getElementById('signUpModal').style.display = 'block';
    });
    document.getElementById('signInButton').addEventListener('click', () => {
        document.getElementById('signInModal').style.display = 'block';
    });
    document.getElementById('signOutButton').addEventListener('click', signOutUser);

    // Modal close action event listeners
    document.getElementById('closeSignUpModalButton').addEventListener('click', closeSignUpModal);
    document.getElementById('closeSignInModalButton').addEventListener('click', closeSignInModal);
    document.getElementById('closeImageContextButton').addEventListener('click', closeImageContextModal);
    document.getElementById('closeUploadModalButton').addEventListener('click', closeUploadModal);

    // Click outside to close modals
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('imageContextModal')) {
            closeImageContextModal();
        }
        if (event.target === document.getElementById('uploadModal')) {
            closeUploadModal();
        }
        if (event.target === document.getElementById('signInModal')) {
            closeSignInModal();
        }
        if (event.target === document.getElementById('signUpModal')) {
            closeSignUpModal();
        }
    });

    // Escape key to close modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            if (document.getElementById('imageContextModal').style.display === 'block') {
                closeImageContextModal();
            }
            if (document.getElementById('uploadModal').style.display === 'block') {
                closeUploadModal();
            }
            if (document.getElementById('signInModal').style.display === 'block') {
                closeSignInModal();
            }
            if (document.getElementById('signUpModal').style.display === 'block') {
                closeSignUpModal();
            }
        }
    });

    // Form submission event listeners
    document.getElementById('signUpForm').addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent the default form submission behavior
    
        // Get email and password input values
        const email = document.getElementById('signUpEmail').value.trim();
        const password = document.getElementById('signUpPassword').value.trim();
    
        // Email format validation using a regular expression
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address.');
            return; // Exit the function if the email does not match the regex pattern
        }
    
        // Firebase authentication logic for signing up
        const auth = getAuth();
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed up successfully
                const user = userCredential.user;
                console.log('User created:', user.uid);
    
                // Close the sign-up modal and reset the form
                closeSignUpModal();
                document.getElementById('signUpForm').reset();
    
                alert('You have successfully signed up and are now logged in.');
    
                // Optionally, update UI or redirect the user
            })
            .catch((error) => {
                // Handle errors, such as email already in use or password too weak
                const errorCode = error.code;
                const errorMessage = error.message;
                alert(`Error ${errorCode}: ${errorMessage}`);
            });
    });

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

    document.getElementById('imageUpload').addEventListener('change', function(event) {
        var reader = new FileReader();
        reader.onload = function() {
            var output = document.getElementById('imagePreview');
            output.src = reader.result;
            output.style.display = 'block';
        };
        reader.readAsDataURL(event.target.files[0]);
    });

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

        // Get the current date
        const currentDate = new Date();
    
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
                    uploadDate: currentDate.toISOString(),
                    url: url
                });
    
                console.log('Document written with ID: ', docRef.id);
                alert('Image uploaded successfully!');
    
                document.getElementById('imageUploadForm').reset();

                document.getElementById('imagePreview').style.display = 'none';
                closeUploadModal();
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

    document.getElementById('cancelUpload').addEventListener('click', function() {
        document.getElementById('imageUploadForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('uploadModal').style.display = "none";
    });

    // Navigation bar
    highlightNavButton();
    
    document.querySelectorAll('.nav-btn').forEach(button => {
    button.addEventListener('click', function(event) {
        scrollToSection(event); 
    });
    });

    // Scroll event for adjusting the active navigation button class
    window.addEventListener('scroll', function() {
        highlightNavButton();
        makeNavbarSticky();
    });

    // Display images for each category
    const categories = ['food', 'fashion', 'sports', 'informative', 'funny', 'history'];
    categories.forEach(async (category) => {
        await displayImagesByCategory(category);
        highlightNavButton();
    });
});
