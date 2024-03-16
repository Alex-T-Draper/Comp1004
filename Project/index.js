import { db, storage } from './firebase-init.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { collection, query, where, getDocs, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInAnonymously, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";


// Authentication Function
function authenticateUser() {
    const auth = getAuth();

    signInAnonymously(auth)
    .then(() => {
        // If successful, you can now get the user's info with auth.currentUser
        console.log('Signed in anonymously');
        const user = auth.currentUser;
        // You can use user.uid to associate with the likes/dislikes etc.
    })
    .catch((error) => {
        // Handle Errors here.
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error(`Error ${errorCode}: ${errorMessage}`);
        // You may want to show the user an error message
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
        imageGridItem.setAttribute('data-id', docSnapshot.id); // Use this attribute to identify the document
        imageGridItem.setAttribute('data-author', data.author);
        imageGridItem.setAttribute('data-category', data.category);
        imageGridItem.setAttribute('data-description', data.description);

        // Create the image element
        const img = document.createElement('img');
        img.src = data.url;
        img.alt = data.description;

        // Create the button to view image details
        const button = document.createElement('button');
        button.className = 'toggle-context';
        button.textContent = '▼';
        button.onclick = async () => {
            try {
                const freshDocSnapshot = await getDoc(doc(db, 'images', docSnapshot.id));
                const freshData = freshDocSnapshot.data();
                openImageContextModal(freshDocSnapshot.id, `
                    <h3>${freshData.imageName}</h3>
                    <img src="${freshData.url}" alt="Image Preview" style="max-width: 100%;"><br>
                    <p>Uploader: ${freshData.author}</p>
                    <p>Category: ${freshData.category}</p>
                    <p>Description: ${freshData.description}</p>
                `);
            } catch (error) {
                console.error('Error fetching fresh data', error);
            }
        };

        // Append the image and button to the div
        imageGridItem.appendChild(img);
        imageGridItem.appendChild(button);

        // Append the div to the container in the HTML
        categoryContainer.appendChild(imageGridItem);
    }
}

// Like and dislike button function
async function updateLikes(docId, isLike) {
    const imageDocRef = doc(db, 'images', docId);
    runTransaction(db, async (transaction) => {
        const imageDoc = await transaction.get(imageDocRef);
        if (!imageDoc.exists()) {
            throw new Error("Document does not exist!");
        }
        const data = imageDoc.data();
        const newLikes = isLike ? (data.likes || 0) + 1 : data.likes;
        const newDislikes = !isLike ? (data.dislikes || 0) + 1 : data.dislikes;
        
        transaction.update(imageDocRef, {
            likes: newLikes, 
            dislikes: newDislikes 
        });
        
        return { newLikes, newDislikes }; // Return the new values so they can be used after the transaction
    }).then(({ newLikes, newDislikes }) => {
        // Update the likes/dislikes counter in the DOM
        const likesCounterElement = document.getElementById(`likes-count-${docId}`);
        const dislikesCounterElement = document.getElementById(`dislikes-count-${docId}`);
        const likeButtonElement = document.getElementById(`like-button-${docId}`);
        const dislikeButtonElement = document.getElementById(`dislike-button-${docId}`);

        if (likesCounterElement && dislikesCounterElement) {
            likesCounterElement.textContent = newLikes;
            dislikesCounterElement.textContent = newDislikes;
            
            // Here we add or remove the 'liked' or 'disliked' class based on the button clicked
            if (isLike) {
                if (likeButtonElement) {
                    likeButtonElement.classList.add('liked');
                    likeButtonElement.classList.remove('disliked'); // in case it was previously disliked
                }
                if (dislikeButtonElement) {
                    dislikeButtonElement.classList.remove('disliked');
                }
            } else {
                if (dislikeButtonElement) {
                    dislikeButtonElement.classList.add('disliked');
                    dislikeButtonElement.classList.remove('liked'); // in case it was previously liked
                }
                if (likeButtonElement) {
                    likeButtonElement.classList.remove('liked');
                }
            }
        }
    }).catch(error => {
        console.error("Transaction failed: ", error);
    });
}

// Function to open the image context modal
async function openImageContextModal(docId) {
    var contextModal = document.getElementById('imageContextModal');
    var contextContent = document.getElementById('imageContextContent');
    
    // Fetch the latest data for the image
    const imageDocRef = doc(db, 'images', docId);
    const imageDocSnap = await getDoc(imageDocRef);
    
    if (imageDocSnap.exists()) {
        const data = imageDocSnap.data();
        
        // Prepare dynamic HTML content with fresh like/dislike counts
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

        document.getElementById(`like-button-${docId}`).addEventListener('click', () => updateLikes(docId, true));
        document.getElementById(`dislike-button-${docId}`).addEventListener('click', () => updateLikes(docId, false));

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
    authenticateUser();
    var modal = document.getElementById('uploadModal');
    var btn = document.getElementById('openModalButton');


    btn.onclick = function() {
        modal.style.display = "block";
    }

    // Sign Up
    // Event listener for the Sign Up button to open the modal
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

    document.getElementById('cancelUpload').addEventListener('click', function() {
        // Reset the form fields
        document.getElementById('imageUploadForm').reset();
        // Hide the image preview
        var output = document.getElementById('imagePreview');
        output.style.display = 'none';
        // Clear the source of the image preview
        output.src = '';
        // Hide the modal
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

