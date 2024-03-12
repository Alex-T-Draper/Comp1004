import { db, storage } from './firebase-init.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('uploadModal');
    var btn = document.getElementById('openModalButton');
    var span = document.getElementsByClassName("close")[0];

    btn.onclick = function() {
        modal.style.display = "block";
    }

    span.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
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
    
        const fileInput = document.getElementById('imageUpload');
        const categoryInput = document.getElementById('imageCategory');
        const descriptionInput = document.getElementById('imageInfo');
        const authorInput = document.getElementById('authorName'); // Assuming you have an input field with the ID 'authorName'
    
        const file = fileInput.files[0];
        const category = categoryInput.value;
        const description = descriptionInput.value;
        const author = authorInput.value; // Retrieve the value of the author input field
    
        if (file) {
            try {
                // Correct storage reference for Firebase Modular
                const imageRef = storageRef(storage, `images/${file.name}`);
                const snapshot = await uploadBytes(imageRef, file);
                const url = await getDownloadURL(imageRef);
    
                // Correct Firestore reference for Firebase Modular
                const imagesCollectionRef = collection(db, 'images');
                const docRef = await addDoc(imagesCollectionRef, {
                    name: file.name,
                    category: category,
                    description: description,
                    author: author, // Store the author's name
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
    
        // Close the modal
        modal.style.display = "none";
    });

  // Cancel upload event
  document.getElementById('cancelUpload').addEventListener('click', function() {
      modal.style.display = "none";
  });

  // Function to open the image context modal
  function openImageContextModal(contentHtml) {
      var contextModal = document.getElementById('imageContextModal');
      var contextContent = document.getElementById('imageContextContent');
      contextContent.innerHTML = contentHtml;
      contextModal.style.display = 'block';
  }

  // Function to close the image context modal
  window.closeImageContextModal = function() {
      var contextModal = document.getElementById('imageContextModal');
      contextModal.style.display = 'none';
  }

  // Close the context modal when the user clicks anywhere outside of the modal-content
  window.onclick = function(event) {
      var contextModal = document.getElementById('imageContextModal');
      if (event.target == contextModal) {
          contextModal.style.display = "none";
      }
  }

  document.querySelectorAll('.toggle-context').forEach(function(button) {
    button.addEventListener('click', function() {
        var imageItem = button.closest('.image-grid-item');
        var imageSrc = imageItem.querySelector('img').src;
        var author = imageItem.getAttribute('data-author'); // Retrieves the author from the data-* attribute
        var category = imageItem.getAttribute('data-category'); // Retrieves the category from the data-* attribute
        var description = imageItem.getAttribute('data-description'); // Retrieves the description from the data-* attribute

        var contentHtml = `<img src="${imageSrc}" alt="Image Preview" style="max-width: 100%;"><br>` +
                          `<p>Author: ${author}</p>` +
                          `<p>Category: ${category}</p>` +
                          `<p>${description}</p>`;
        openImageContextModal(contentHtml);
    });
});

  // Smooth scroll to headers and highlight active nav button
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

  // Highlight the navigation button of the visible section
  function highlightNavButton() {
      var sections = document.querySelectorAll('header h2');
      sections.forEach((section, index) => {
          var rect = section.getBoundingClientRect();
          if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
              navButtons.forEach(button => button.classList.remove('active'));
              navButtons[index].classList.add('active');
          }
      });
  }

  // Event listener for scroll events to trigger highlight
  window.addEventListener('scroll', highlightNavButton);

  // Call the function to set the initial state
  highlightNavButton();
});

document.addEventListener('DOMContentLoaded', function() {
  const navBar = document.querySelector('.nav_bar');
  const offset = navBar.offsetTop; // Get the initial top offset of the nav bar

  function scrollHandler() {
      if (window.pageYOffset >= offset) {
          navBar.classList.add('fixed');
      } else {
          navBar.classList.remove('fixed');
      }
  }

  window.addEventListener('scroll', scrollHandler);
});