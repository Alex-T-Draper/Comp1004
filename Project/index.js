import { db, storage } from './firebase-init.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Function to display images by category
async function displayImagesByCategory(categoryName) {
    // Reference to the container in your HTML where the images will be displayed
    console.log(`Querying for .${categoryName}-images .image-gallery`);
    const categoryContainer = document.querySelector(`.${categoryName}-images`);
    console.log(categoryContainer);
    
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
    for (const doc of querySnapshot.docs) {
        const data = doc.data();

        // Create a div to hold the image and its associated data
        const imageGridItem = document.createElement('div');
        imageGridItem.setAttribute('data-image-name', data.imageName)
        imageGridItem.className = 'image-grid-item';
        imageGridItem.setAttribute('data-author', data.author);
        imageGridItem.setAttribute('data-category', data.category);
        imageGridItem.setAttribute('data-description', data.description);

        // Create the image element
        const img = document.createElement('img');
        img.src = data.url;
        img.alt = data.description; // Use the description as the alt text

        // Create the fields for HTML from Firebase
        const button = document.createElement('button');
        button.className = 'toggle-context';
        button.textContent = '▼';
        button.onclick = () => openImageContextModal(
            `<h3>${data.imageName}</h3>
            <img src="${data.url}" alt="Image Preview" style="max-width: 100%;"><br>
            <p>Uploader: ${data.author}</p>
            <p>Category: ${data.category}</p>
            <p>Description: ${data.description}</p>`
        );

        // Append the image and button to the div
        imageGridItem.appendChild(img);
        imageGridItem.appendChild(button);

        // Append the div to the container in the HTML
        categoryContainer.appendChild(imageGridItem);
    }
}

// Function to open the image context modal
function openImageContextModal(contentHtml) {
    var contextModal = document.getElementById('imageContextModal');
    var contextContent = document.getElementById('imageContextContent');
    contextContent.innerHTML = contentHtml;
    contextModal.style.display = 'block';
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
    
    var modal = document.getElementById('uploadModal');
    var btn = document.getElementById('openModalButton');


    btn.onclick = function() {
        modal.style.display = "block";
    }

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
                    url: url
                });
    
                console.log('Document written with ID: ', docRef.id);
                alert('Image uploaded successfully!');
    
                document.getElementById('imageUploadForm').reset();
                document.getElementById('imagePreview').style.display = 'none';
    
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

