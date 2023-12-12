	document.getElementById('volumeButton').addEventListener('click', function() {
    var slider = document.getElementById('volumeSlider');
    slider.style.display = slider.style.display === 'none' ? 'block' : 'none';
});

	document.getElementById('volumeSlider').addEventListener('input', function(e) {
    var volume = e.target.value;
    document.getElementById('myAudio').volume = volume;
    console.log("Volume set to: " + volume);
});
   var isImageOne = true;
	document.getElementById('myAudio').volume = 0.5; // 50% volume
    document.getElementById('playButton').addEventListener('click', function() {
		var audio = document.getElementById('myAudio')
		  if (audio.paused) {
            audio.play();
        } else {
            audio.pause(); // Optional: Restart the song if already playing
        }
        if (isImageOne) {
            document.getElementById('buttonImage').src = '../IMAGE/Icon/Pause Button.gif';
        } else {
            document.getElementById('buttonImage').src = '../IMAGE/Icon/Play Button.gif';
        }
	
        isImageOne = !isImageOne; // Toggle the flag
		musicOff = !musicOff;
    });
