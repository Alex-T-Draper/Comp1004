import { db, storage } from './firebase-init.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { collection, query, where, getDocs, addDoc, getDoc, updateDoc, doc, runTransaction, serverTimestamp, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

            // Determine the new like/dislike state
            if (isLike) {
                if (reactionData.like) {
                    // If user already liked the image, decrement likes
                    likes--;
                    reactionData.like = false;
                } else {
                    // If user hasn't liked it yet, increment likes
                    likes++;
                    // If user previously disliked, decrement dislikes
                    if (reactionData.dislike) {
                        dislikes--;
                        reactionData.dislike = false;
                    }
                    reactionData.like = true;
                }
            } else {
                if (reactionData.dislike) {
                    // If user already disliked the image, decrement dislikes
                    dislikes--;
                    reactionData.dislike = false;
                } else {
                    // If user hasn't disliked it yet, increment dislikes
                    dislikes++;
                    // If user previously liked, decrement likes
                    if (reactionData.like) {
                        likes--;
                        reactionData.like = false;
                    }
                    reactionData.dislike = true;
                }
            }

            transaction.update(imageDocRef, { likes, dislikes });
            transaction.set(userReactionRef, reactionData);

            return { likes, dislikes, reactionData }; // Return the new reaction data
        });

        // Update the UI based on the new reaction data
        const likeButtonElement = document.getElementById(`like-button-${docId}`);
        const dislikeButtonElement = document.getElementById(`dislike-button-${docId}`);
        likeButtonElement.classList.toggle('liked', transactionResult.reactionData.like);
        dislikeButtonElement.classList.toggle('disliked', transactionResult.reactionData.dislike);

        document.getElementById(`likes-count-${docId}`).textContent = transactionResult.likes;
        document.getElementById(`dislikes-count-${docId}`).textContent = transactionResult.dislikes;
    } catch (error) {
        console.error("Transaction failed: ", error);
    }
}

// Display Comment Function
async function displayComments(docId) {
    const commentsContainer = document.getElementById(`comments-container-${docId}`);
    const commentsRef = collection(db, `images/${docId}/comments`);
    const q = query(commentsRef, orderBy("timestamp", "asc")); // Order by timestamp
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

// Submit Comment function
async function submitComment(docId) {
    const commentInput = document.getElementById(`comment-input-${docId}`);
    const commentText = commentInput.value.trim();
    const auth = getAuth();
    const user = auth.currentUser;

    // Set a maximum word limit
    const maxWordLimit = 100;
    const wordCount = commentText.split(/\s+/).length; 
    
    if (commentText === '') {
      alert('Comment cannot be empty.');
      return;
    }
  
    if (!user) {
      alert('You must be logged in to post comments.');
      return;
    }

    if (wordCount > maxWordLimit) {
        alert(`Comment cannot exceed ${maxWordLimit} words. You have used ${wordCount} words.`);
        return;
    }

    try {
        const commentsRef = collection(db, `images/${docId}/comments`);
        await addDoc(commentsRef, {
            text: commentText,
            user: user.email, 
            timestamp: serverTimestamp() // Firebase server timestamp for comment ordering
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
        const auth = getAuth();
        const user = auth.currentUser;

        // If user is logged in show these buttons
        let deleteButtonHtml = '';
        if (user && data.uploaderEmail === user.email) {
            deleteButtonHtml = `<button onclick="deletePost('${docId}')" class="delete-button">Delete Post</button>`;
        }

        let editButtonHtml = '';
        if (user && data.uploaderEmail === user.email) {
            editButtonHtml = `<button id="editButton-${docId}" class="edit-button">Edit Details</button>`;
        }

        // Load the content for the image
        const dynamicContentHtml = `
            <h3 class="image-detail image-imageName">${data.imageName}</h3>
            <h4 class="image-detail image-category">${data.category}</h4>
            <img src="${data.url}" alt="Image Preview" style="max-width: 100%; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <p><span class="static-text">Uploaded by: </span><span class="image-detail image-author">${data.author}</span></p>
                <p>Uploaded: ${uploadDate.toLocaleDateString()}</p>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                <p><span class="static-text">Description: </span><span class="image-detail image-description">${data.description}</span></p>
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
            <div style="display: flex; justify-content: space-between;">
                <h5>Comments</h5>
                <div class="reaction-container">
                ${deleteButtonHtml}
                ${editButtonHtml}
                </div>
            </div>
            <div id="comments-container-${docId}" style="max-height: 150px; overflow-y: auto;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <textarea id="comment-input-${docId}" placeholder="Add a comment..." style="width: 85%; height: 50px;"></textarea>
                <button id="post-comment-button-${docId}" style="width: 100px;">Post Comment</button>
            </div>
        `;

        contextContent.innerHTML = dynamicContentHtml;

        // If the delete button or edit button exists add an event listener to it
        const deleteButton = contextContent.querySelector('.delete-button');
        if (deleteButton) {
            deleteButton.addEventListener('click', function() {
                deletePost(docId);
            });
        }

        const editButton = document.getElementById(`editButton-${docId}`);
        if (editButton) {
            editButton.addEventListener('click', function() {
                toggleEdit(docId, this);
            });
        }

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

// Toggle between edit and view mode
function toggleEdit(docId, buttonElement) {
    const isEditing = buttonElement.textContent === 'Edit Details';
    const detailsFields = ['imageName', 'category', 'description', 'author'];

    // If currently editing, switch to save mode
    if (isEditing) {
        buttonElement.textContent = 'Save Changes';

        // Store the old category in the dataset of the button
        const categoryElement = document.querySelector(`#imageContextContent .image-category`);
        buttonElement.dataset.oldCategory = categoryElement.textContent.trim();

        // Convert each detail field into an editable input or select
        detailsFields.forEach(field => {
            const fieldElement = document.querySelector(`.image-${field}`);
            if (fieldElement) {
                if (field === 'category') {
                    // Select element for category
                    const selectElement = document.createElement('select');
                    selectElement.innerHTML = `
                        <option value="food">Food</option>
                        <option value="fashion">Fashion</option>
                        <option value="sports">Sports</option>
                        <option value="informative">Informative</option>
                        <option value="funny">Funny</option>
                        <option value="history">History</option>
                        <option value="other">Other</option>
                    `;
                    selectElement.value = fieldElement.textContent; 
                    selectElement.classList.add('image-detail-input');
                    selectElement.dataset.field = field;
                    fieldElement.textContent = '';
                    fieldElement.appendChild(selectElement);
                } else {
                    // Create an input element for other fields
                    const inputElement = document.createElement('input');
                    inputElement.type = 'text';
                    inputElement.value = fieldElement.textContent;
                    inputElement.classList.add('image-detail-input');
                    inputElement.dataset.field = field;
                    fieldElement.textContent = '';
                    fieldElement.appendChild(inputElement);
                }
            } else {
                console.error(`Element with class .image-${field} not found.`);
            }
        });
    } else {
        // Collect updated data from input fields
        const updatedData = {};
        let isDataValid = true;

        detailsFields.forEach(field => {
            const inputElement = document.querySelector(`.image-detail-input[data-field="${field}"]`);
            if (inputElement) {
                // Validate that the field is not empty
                if ((field === 'description' || field === 'author' || field === 'imageName') && !inputElement.value.trim()) {
                    const fieldNameFormatted = field.split(/(?=[A-Z])/).join(" ").replace(/^\w/, c => c.toUpperCase());
                    alert(`${fieldNameFormatted} cannot be empty.`);
                    inputElement.focus();
                    isDataValid = false;
                    return;
                }
                updatedData[field] = field === 'category' ? inputElement.value : inputElement.value.trim();
            }
        });

        if (!isDataValid) {
            return; // Stop if the data is invalid
        }

        // Update Firestore document
        const oldCategory = buttonElement.dataset.oldCategory;
        updateImageDetails(docId, updatedData, oldCategory);
        delete buttonElement.dataset.oldCategory;

        buttonElement.textContent = 'Edit Details';

        // Replace inputs and selects with plain text
        detailsFields.forEach(field => {
            const fieldElement = document.querySelector(`.image-${field}`);
            if (field === 'category') {
                // Replace the select element with plain text
                const selectElement = fieldElement.querySelector('select');
                fieldElement.textContent = selectElement.options[selectElement.selectedIndex].text;
            } else {
                // Replace the input element with plain text
                const inputElement = fieldElement.querySelector('input');
                fieldElement.textContent = inputElement.value;
            }
        });
    }
}

// Firestore update on edit
async function updateImageDetails(docId, updatedData, oldCategory) {
    const imageDocRef = doc(db, 'images', docId);
    
    try {
        await updateDoc(imageDocRef, updatedData);
        alert('Image details updated successfully.');

        // Check if category has changed and remove the image from the old category
        if (oldCategory !== updatedData.category) {
            const oldCategoryContainer = document.querySelector(`.${oldCategory}-images`);
            const imageElement = oldCategoryContainer ? oldCategoryContainer.querySelector(`[data-id="${docId}"]`) : null;
            if (imageElement) {
                oldCategoryContainer.removeChild(imageElement); 
            }
            await displayImagesByCategory(updatedData.category);
        }
        closeImageContextModal();
    } catch (error) {
        console.error('Error updating image details:', error);
        alert('An error occurred while updating the details. Please try again.');
    }
}

// Function to delete a post and subcollection
async function deletePost(docId) {
    const confirmation = confirm('Are you sure you want to delete this post?');

    if (!confirmation) {
        return;
    }

    // Start a batch operation as we have image and subcollection comments
    const batch = writeBatch(db);

    // Reference to the image document
    const imageDocRef = doc(db, 'images', docId);
    batch.delete(imageDocRef);

    // Reference to the comments subcollection of the image
    const commentsCollectionRef = collection(db, `images/${docId}/comments`);

    try {
        // Get all comments associated with the image
        const commentsSnapshot = await getDocs(commentsCollectionRef);
        commentsSnapshot.forEach((commentDoc) => {
            batch.delete(commentDoc.ref);
        });

        // Commit the batch to delete the image and all comments
        await batch.commit();
        alert('The post has been deleted.');
        closeImageContextModal(); 
        const imageElement = document.querySelector(`[data-id="${docId}"]`);
        if (imageElement) {
            imageElement.remove();
        }
    } catch (error) {
        console.error('Error deleting post and comments:', error);
        alert('An error occurred while trying to delete the post.');
    }
}

// Function to close the sign-up modal
function closeSignUpModal() {
    document.getElementById('signUpModal').style.display = 'none';
    document.getElementById('signUpButton').classList.remove('active');
}

// Function to close the sign-in modal
function closeSignInModal() {
    document.getElementById('signInModal').style.display = 'none';
    document.getElementById('signInButton').classList.remove('active');
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

    // No section is active initially
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
    // Set the clicked button as active
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const targetId = event.currentTarget.getAttribute('data-target');
    const section = document.getElementById(targetId);
    // Account for size of nav bar
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
    // Make nav bar sticky
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

    // Form submission event listeners (Sign in and Sign up)
    document.getElementById('signUpForm').addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent the default form submission behavior
    
        // Get email and password input values
        const email = document.getElementById('signUpEmail').value.trim();
        const password = document.getElementById('signUpPassword').value.trim();
        const passwordMatch = document.getElementById('signUpPasswordMatch').value
    
        // Email format validation using a regular expression
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address.');
            return; 
        }

        // Check if passwords match
        if (password != passwordMatch) {
            alert('Password must match');
            return;
        }
    
        // Firebase authentication logic for signing up
        const auth = getAuth();
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Create new user
                const user = userCredential.user;
                console.log('User created:', user.uid);
    
                closeSignUpModal();
                document.getElementById('signUpForm').reset();
                // Successful
                alert('You have successfully signed up and are now logged in.');
            })
            .catch((error) => {
                // Handle errors
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

                document.getElementById('signInModal').style.display = 'none';
                document.getElementById('signInForm').reset();
            })
            .catch((error) => {
                // Handle errors
                const errorCode = error.code;
                const errorMessage = error.message;
                alert(`Error ${errorCode}: ${errorMessage}`);
            });
    });

    // Image Upload
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

        const submitButton = document.getElementById('buttonUpload');
        submitButton.disabled = true;
        submitButton.textContent = 'Uploading...';

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            alert('You must be logged in to upload images.');
            return;
        }

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
        const uploaderEmail = user.email;

        const maxWordLimitImageName = 7;
        const maxWordLimitDescription = 100;
        const maxWordLimitAuthor = 5;

        // Regex for length
        const wordCountImageName = imageName.split(/\s+/).length
        const wordCountDescription = description.split(/\s+/).length;
        const wordCountAuthor = author.split(/\s+/).length;

        if (wordCountAuthor > maxWordLimitAuthor){
            alert(`Author name cannot exceed ${maxWordLimitAuthor} words. You have used ${wordCountAuthor} words.`)
            return;
        }

        if (wordCountImageName > maxWordLimitImageName){
            alert(`Image name cannot exceed ${maxWordLimitImageName} words. You have used ${wordCountImageName} words.`)
            return;
        }

        if (wordCountDescription > maxWordLimitDescription) {
            alert(`Description cannot exceed ${maxWordLimitDescription} words. You have used ${wordCount} words.`);
            return;
        }

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
                    uploaderEmail: uploaderEmail,
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

        submitButton.disabled = false;
        submitButton.textContent = 'Upload';
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

    window.addEventListener('scroll', function() {
        highlightNavButton();
        makeNavbarSticky();
    });

    // Display images for each category
    const categories = ['food', 'fashion', 'sports', 'informative', 'funny', 'history', 'other'];
    categories.forEach(async (category) => {
        await displayImagesByCategory(category);
        highlightNavButton();
    });
});