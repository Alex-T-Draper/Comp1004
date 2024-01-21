document.addEventListener('DOMContentLoaded', function() {
    // Get the modal
    var modal = document.getElementById('uploadModal');
    
    // Get the button that opens the modal
    var btn = document.getElementById('openModalButton'); // You'll need a button to open the modal
    
    // Get the <span> element that closes the modal
    var span = document.getElementsByClassName("close")[0];
    
    // When the user clicks the button, open the modal 
    btn.onclick = function() {
      modal.style.display = "block";
    }
    
    // When the user clicks on <span> (x), close the modal
    span.onclick = function() {
      modal.style.display = "none";
    }
    
    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
      if (event.target == modal) {
        modal.style.display = "none";
      }
    }
    
    // Handle image preview
    document.getElementById('imageUpload').addEventListener('change', function(event) {
      var reader = new FileReader();
      reader.onload = function() {
        var output = document.getElementById('imagePreview');
        output.src = reader.result;
        output.style.display = 'block';
      };
      reader.readAsDataURL(event.target.files[0]);
    });
    
    // Handle form submission
    document.getElementById('imageUploadForm').addEventListener('submit', function(event) {
      event.preventDefault();
      // Process form: collect data, store it, and upload the image as needed
      // ...
      
      // Close the modal after submission
      modal.style.display = "none";
    });
    
    // Handle cancel button
    document.getElementById('cancelUpload').addEventListener('click', function() {
      modal.style.display = "none";
    });
  });