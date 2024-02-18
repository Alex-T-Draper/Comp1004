document.addEventListener('DOMContentLoaded', function() {
  // Modal elements for image upload
  var modal = document.getElementById('uploadModal');
  var btn = document.getElementById('openModalButton'); // Button to open the modal
  var span = document.getElementsByClassName("close")[0]; // Close button for the modal

  // Open upload modal event
  btn.onclick = function() {
      modal.style.display = "block";
  }

  // Close upload modal events
  span.onclick = function() {
      modal.style.display = "none";
  }
  window.onclick = function(event) {
      if (event.target === modal) {
          modal.style.display = "none";
      }
  }

  // Image preview event
  document.getElementById('imageUpload').addEventListener('change', function(event) {
      var reader = new FileReader();
      reader.onload = function() {
          var output = document.getElementById('imagePreview');
          output.src = reader.result;
          output.style.display = 'block';
      };
      reader.readAsDataURL(event.target.files[0]);
  });

  // Form submission event
  document.getElementById('imageUploadForm').addEventListener('submit', function(event) {
      event.preventDefault();
      // Add form submission logic here
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