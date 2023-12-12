(function(storyContent) {

    // Create ink story from the content using inkjs
    var story = new inkjs.Story(storyContent);
	// Here's the function
	story.BindExternalFunction ("get_name", () => {
    // 'prompt' is a built-in Javascript method
    return prompt("Welcome to Pony Adventure, your first step on your journey is answering the following question. What is your name?", "Anon");
	});

    var savePoint = "";

    let savedTheme;
    let globalTagTheme;

    // Global tags - those at the top of the ink file
    // We support:
    //  # theme: dark
    //  # author: Your Name
    var globalTags = story.globalTags;
    if( globalTags ) {
        for(var i=0; i<story.globalTags.length; i++) {
            var globalTag = story.globalTags[i];
            var splitTag = splitPropertyTag(globalTag);

            // THEME: dark
            if( splitTag && splitTag.property == "theme" ) {
                globalTagTheme = splitTag.val;
            }

            // author: Your Name
            else if( splitTag && splitTag.property == "author" ) {
                var byline = document.querySelector('.byline');
                byline.innerHTML = "by "+splitTag.val;
            }
        }
    }

    var storyContainer = document.querySelector('#story');
    var outerScrollContainer = document.querySelector('.outerContainer');
	var bodyContainer = document.querySelector('body');
    // page features setup
    setupTheme(globalTagTheme);
    var hasSave = loadSavePoint();
    setupButtons(hasSave);

    // Set initial save point
    savePoint = story.state.toJson();

    // Kick off the start of the story!
    continueStory(true);

    // Main story processing function. Each time this is called it generates
    // all the next content up as far as the next set of choices.
    function continueStory(firstTime) {

        var paragraphIndex = 0;
        var delay = 0.0;

        // Don't over-scroll past new content
        var previousBottomEdge = firstTime ? 0 : contentBottomEdgeY();

        // Generate story text - loop through available content
        while(story.canContinue) {

            // Get ink to generate the next paragraph
            var paragraphText = story.Continue();
            var tags = story.currentTags;

            // Any special tags included with this line
            var customClasses = [];
            for(var i=0; i<tags.length; i++) {
                var tag = tags[i];

                // Detect tags of the form "X: Y". Currently used for IMAGE and CLASS but could be
                // customised to be used for other things too.
                var splitTag = splitPropertyTag(tag);

                // AUDIO: src
                if( splitTag && splitTag.property == "AUDIO" ) {
                  if('audio' in this) {
                    this.audio.pause();
                    this.audio.removeAttribute('src');
                    this.audio.load();
                  }
                  this.audio = new Audio(splitTag.val);
                  this.audio.play();
                }

                // AUDIOLOOP: src
                else if( splitTag && splitTag.property == "AUDIOLOOP" ) {
                  if('audioLoop' in this) {
                    this.audioLoop.pause();
                    this.audioLoop.removeAttribute('src');
                    this.audioLoop.load();
                  }
                  this.audioLoop = new Audio(splitTag.val);
				  this.audioLoop.volume = 0.5
                  this.audioLoop.play();
                  this.audioLoop.loop = true;
                }

                // IMAGE: src
                if( splitTag && splitTag.property == "IMAGE" ) {
                    var imageElement = document.createElement('img');
                    imageElement.src = splitTag.val;
                    storyContainer.appendChild(imageElement);

                    showAfter(delay, imageElement);
                    delay += 200.0;
                }

				// INPUT BAR: src
                if( splitTag && splitTag.property == "INPUT" ) {
                    var inputElement = document.createElement('input');
                    inputElement.src = splitTag.val;
                    storyContainer.appendChild(inputElement);

                    showAfter(delay, inputElement);
                    delay += 200.0;
                }
                // LINK: url
                else if( splitTag && splitTag.property == "LINK" ) {
                    window.location.href = splitTag.val;
                }

                // LINKOPEN: url
                else if( splitTag && splitTag.property == "LINKOPEN" ) {
                    window.open(splitTag.val);
                }

                // BACKGROUND: src
                else if( splitTag && splitTag.property == "BACKGROUND" ) {
                    bodyContainer.style.backgroundImage = 'url('+splitTag.val+')';
                }

                // CLASS: className
                else if( splitTag && splitTag.property == "CLASS" ) {
                    customClasses.push(splitTag.val);
                }

                // CLEAR - removes all existing content.
                // RESTART - clears everything and restarts the story from the beginning
                else if( tag == "CLEAR" || tag == "RESTART" ) {
                    removeAll("p");
                    removeAll("img");

                    // Comment out this line if you want to leave the header visible when clearing
                    setVisible(".header", false);

                    if( tag == "RESTART" ) {
                        restart();
                        return;
                    }
                }
            }

            // Create paragraph element (initially hidden)
            var paragraphElement = document.createElement('p');
            paragraphElement.innerHTML = paragraphText;
            storyContainer.appendChild(paragraphElement);

            // Add any custom classes derived from ink tags
            for(var i=0; i<customClasses.length; i++)
                paragraphElement.classList.add(customClasses[i]);

            // Fade in paragraph after a short delay
            showAfter(delay, paragraphElement);
            delay += 200.0;
        }

        // Create HTML choices from ink choices
        story.currentChoices.forEach(function(choice) {
	// Wrapping in a timer function to allow images to load before calculating & scrolling to the bottom of the page 
        setTimeout(() => { 
            // Extend height to fit 
            // We do this manually so that removing elements and creating new ones doesn't 
            // cause the height (and therefore scroll) to jump backwards temporarily. 
            storyContainer.style.height = contentBottomEdgeY()+"px"; 

            if( !firstTime ) 
            scrollDown(previousBottomEdge); 

        }, 700);
            // Create paragraph with anchor element
            var choiceParagraphElement = document.createElement('button');
            choiceParagraphElement.classList.add("choice");
            choiceParagraphElement.innerHTML = `<a href='#'>${choice.text}</a>`
            storyContainer.appendChild(choiceParagraphElement);

            // Fade choice in after a short delay
            showAfter(delay, choiceParagraphElement);
            delay += 200.0;

            // Click on choice
            var choiceAnchorEl = choiceParagraphElement.querySelectorAll("a")[0];
            choiceAnchorEl.addEventListener("click", function(event) {

                // Don't follow <a> link
                event.preventDefault();

                // Remove all existing choices
                removeAll(".choice");

                // Tell the story where to go next
                story.ChooseChoiceIndex(choice.index);

                // This is where the save button will save from
                savePoint = story.state.toJson();

                // Aaand loop
                continueStory();
            });
        });

        // Extend height to fit
        // We do this manually so that removing elements and creating new ones doesn't
        // cause the height (and therefore scroll) to jump backwards temporarily.
        storyContainer.style.height = contentBottomEdgeY()+"px";

        if( !firstTime )
            scrollDown(previousBottomEdge);

    }

    function restart() {
        story.ResetState();

        setVisible(".header", true);

        // set save point to here
        savePoint = story.state.toJson();

        continueStory(true);

        outerScrollContainer.scrollTo(0, 0);
    }

    // -----------------------------------
    // Various Helper functions
    // -----------------------------------

    // Fades in an element after a specified delay
    function showAfter(delay, el) {
        el.classList.add("hide");
        setTimeout(function() { el.classList.remove("hide") }, delay);
    }

    // Scrolls the page down, but no further than the bottom edge of what you could
    // see previously, so it doesn't go too far.
    function scrollDown(previousBottomEdge) {

        // Line up top of screen with the bottom of where the previous content ended
        var target = previousBottomEdge;

        // Can't go further than the very bottom of the page
        var limit = outerScrollContainer.scrollHeight - outerScrollContainer.clientHeight;
        if( target > limit ) target = limit;

        var start = outerScrollContainer.scrollTop;

        var dist = target - start;
        var duration = 300 + 300*dist/100;
        var startTime = null;
        function step(time) {
            if( startTime == null ) startTime = time;
            var t = (time-startTime) / duration;
            var lerp = 3*t*t - 2*t*t*t; // ease in/out
            outerScrollContainer.scrollTo(0, (1.0-lerp)*start + lerp*target);
            if( t < 1 ) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // The Y coordinate of the bottom end of all the story content, used
    // for growing the container, and deciding how far to scroll.
    function contentBottomEdgeY() {
        var bottomElement = storyContainer.lastElementChild;
        return bottomElement ? bottomElement.offsetTop + bottomElement.offsetHeight : 0;
    }

    // Remove all elements that match the given selector. Used for removing choices after
    // you've picked one, as well as for the CLEAR and RESTART tags.
    function removeAll(selector)
    {
        var allElements = storyContainer.querySelectorAll(selector);
        for(var i=0; i<allElements.length; i++) {
            var el = allElements[i];
            el.parentNode.removeChild(el);
        }
    }

    // Used for hiding and showing the header when you CLEAR or RESTART the story respectively.
    function setVisible(selector, visible)
    {
        var allElements = storyContainer.querySelectorAll(selector);
        for(var i=0; i<allElements.length; i++) {
            var el = allElements[i];
            if( !visible )
                el.classList.add("invisible");
            else
                el.classList.remove("invisible");
        }
    }

    // Helper for parsing out tags of the form:
    //  # PROPERTY: value
    // e.g. IMAGE: source path
    function splitPropertyTag(tag) {
        var propertySplitIdx = tag.indexOf(":");
        if( propertySplitIdx != null ) {
            var property = tag.substr(0, propertySplitIdx).trim();
            var val = tag.substr(propertySplitIdx+1).trim();
            return {
                property: property,
                val: val
            };
        }

        return null;
    }

    // Loads save state if exists in the browser memory
    function loadSavePoint() {

        try {
            let savedState = window.localStorage.getItem('save-state');
            if (savedState) {
                story.state.LoadJson(savedState);
                return true;
            }
        } catch (e) {
            console.debug("Couldn't load save state");
        }
        return false;
    }

    // Detects which theme (light or dark) to use
    function setupTheme(globalTagTheme) {

        // load theme from browser memory
        var savedTheme;
        try {
            savedTheme = window.localStorage.getItem('theme');
        } catch (e) {
            console.debug("Couldn't load saved theme");
        }

        // Check whether the OS/browser is configured for dark mode
        var browserDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        if (savedTheme === "dark"
            || (savedTheme == undefined && globalTagTheme === "dark")
            || (savedTheme == undefined && globalTagTheme == undefined && browserDark))
            document.body.classList.add("dark");
    }

    // Used to hook up the functionality for global functionality buttons
    function setupButtons(hasSave) {

        let rewindEl = document.getElementById("rewind");
        if (rewindEl) rewindEl.addEventListener("click", function(event) {
            removeAll("p");
            removeAll("img")
			removeAll(".choice");
            setVisible(".header", false);
            restart();
        });


function saveGameSlot(slotIndex) {
    try {
        let savedSlots = JSON.parse(window.localStorage.getItem('save-slots')) || [];

        // Assuming story.state.SaveJson is a function to get the serialized state
        let currentState = story.state.toJson();

        // Update or add the saved state to the specified slot
        savedSlots[slotIndex] = currentState;

        // Save the updated slots array back to local storage
        window.localStorage.setItem('save-slots', JSON.stringify(savedSlots));

        // Enable the load button assuming you want to enable it after a save
        document.getElementById("loadtab").removeAttribute("disabled");

        console.log(`Game saved to Slot ${slotIndex + 1}`);
    } catch (e) {
        console.debug("Couldn't save game state");
    }
}


function loadSaveSlot(slotIndex) {
    let reloadEl = document.getElementById("loadbutton");
    
    // Assuming hasSave is a boolean indicating whether there is a save in the specified slot
    if (!hasSave(slotIndex)) {
        reloadEl.setAttribute("disabled", "disabled");
    }

    reloadEl.addEventListener("click", function(event) {
        if (reloadEl.getAttribute("disabled")) {
            return;
        }

        removeAll("p");
        removeAll("img");
        removeAll(".choice");

        try {
            let savedSlots = JSON.parse(window.localStorage.getItem('save-slots')) || [];

            if (slotIndex >= 0 && slotIndex < savedSlots.length) {
                let savedState = savedSlots[slotIndex];
                // Assuming story.state.LoadJson is a function to load the state
                story.state.LoadJson(savedState);
            }
        } catch (e) {
            console.debug("Couldn't load save state");
        }

        // Assuming continueStory is a function to continue the story/game
        continueStory(true);
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const saveSlotsContainer = document.getElementById("saveSlotsContainer");
    const saveButton = document.getElementById("saveButton");
    const loadButton = document.getElementById("loadButton");
    const textContainer = document.getElementById("story"); // Assuming you have a container with ID "textContainer"

    saveButton.addEventListener("click", function () {
        // Replace 0 with the desired slot index
        saveGameSlot(0);
        renderSaveSlots();
    });

    loadButton.addEventListener("click", function () {
        // Replace 0 with the desired slot index
        loadSaveSlot(0);
        loadTextContent(0); // Load text content as well
    });

    // Function to render save slots
    function renderSaveSlots() {
        saveSlotsContainer.innerHTML = ""; // Clear previous slots

        let savedSlots = JSON.parse(window.localStorage.getItem('save-slots')) || [];

        savedSlots.forEach((save, index) => {
            const saveSlot = document.createElement("div");
            saveSlot.classList.add("save-slot");
            saveSlot.textContent = `Save Slot ${index + 1}`;

            // Add click event to load the selected save
            saveSlot.addEventListener("click", () => {
                loadSaveSlot(index);
                loadTextContent(index); // Load text content as well
            });

            saveSlotsContainer.appendChild(saveSlot);
        });
    }

    // Function to save the game into a specific slot
    function saveGameSlot(slotIndex) {
        try {
            let savedSlots = JSON.parse(window.localStorage.getItem('save-slots')) || [];
            let currentState = story.state.toJson(); // Replace with your actual method to get the serialized state

            savedSlots[slotIndex] = currentState;
            window.localStorage.setItem('save-slots', JSON.stringify(savedSlots));

            console.log(`Game saved to Slot ${slotIndex + 1}`);
        } catch (e) {
            console.debug("Couldn't save game state");
        }
    }

    // Function to load the game from a specific save slot
    function loadSaveSlot(slotIndex) {
        try {
            let savedSlots = JSON.parse(window.localStorage.getItem('save-slots')) || [];

            if (slotIndex >= 0 && slotIndex < savedSlots.length) {
                let savedState = savedSlots[slotIndex];
                // Replace the following line with your actual method to load the game state
                console.log(`Loading game from Save Slot ${slotIndex + 1} - State: ${savedState}`);
            }
        } catch (e) {
            console.debug("Couldn't load save state");
        }
    }

    // Function to load text content from a specific save slot
    function loadTextContent(slotIndex) {
        try {
            let savedSlots = JSON.parse(window.localStorage.getItem('save-slots')) || [];

            if (slotIndex >= 0 && slotIndex < savedSlots.length) {
                let textContent = savedSlots[slotIndex].textContent;

                // Replace the following line with your actual method to set the text content
                textContainer.textContent = textContent;
                console.log(`Text content loaded from Save Slot ${slotIndex + 1}`);
            }
        } catch (e) {
            console.debug("Couldn't load text content");
        }
    }

    // Render initial save slots
    renderSaveSlots();
});



        let themeSwitchEl = document.getElementById("theme-switch");
        if (themeSwitchEl) themeSwitchEl.addEventListener("click", function(event) {
            document.body.classList.add("switched");
            document.body.classList.toggle("dark");
        });

	
	}
	// Get references to the buttons using their IDs
	var btnShowPage1 = document.getElementById("scenetab");
	var btnShowPage2 = document.getElementById("statstab");
	var btnShowPage3 = document.getElementById("statustab");
	var btnShowPage4 = document.getElementById("inventorytab");
	var btnShowPage5 = document.getElementById("spellstab");
	var btnShowPage6 = document.getElementById("savetab");

	// Get references to the page div elements using their IDs
	var page1 = document.getElementById("story");
	var page2 = document.getElementById("stats");
	var page3 = document.getElementById("status");
	var page4 = document.getElementById("inventory");
	var page5 = document.getElementById("spells");
	var page6 = document.getElementById("save");


	// Define event listeners and their corresponding actions
	btnShowPage1.addEventListener("click", function() {
	hideAllPages();
	page1.style.display = "block";
	});

	btnShowPage2.addEventListener("click", function() {
	hideAllPages();
	page2.style.display = "block";
	});

	btnShowPage3.addEventListener("click", function() {
	hideAllPages();
	page3.style.display = "block";
	})
	btnShowPage4.addEventListener("click", function() {
	hideAllPages();
	page4.style.display = "block";
	});

	btnShowPage5.addEventListener("click", function() {
	hideAllPages();
	page5.style.display = "block";
	});

	btnShowPage6.addEventListener("click", function() {
	hideAllPages();
	page6.style.display = "block";
  

	});

	// Function to hide all page div elements
	function hideAllPages() {
	page1.style.display = "none";
	page2.style.display = "none";
	page3.style.display = "none";
	page4.style.display = "none";
	page5.style.display = "none";
	page6.style.display = "none";
	};
	
	// Stats
		story.ObserveVariable("strength", function(variableName, variableValue) {
			document.getElementById("StrengthNum").innerText = variableValue
			if (variableValue === 1) {document.getElementById("StrengthComment").innerText = "Morbidly Weak."}
			else if (variableValue < 3) {document.getElementById("StrengthComment").innerText = "Watch out for strong winds."}
			else if (variableValue < 5) {document.getElementById("StrengthComment").innerText = "Visibly weak."}
			else if (variableValue < 7 ){document.getElementById("StrengthComment").innerText = "Not the strongest."}
			else if (variableValue < 9 ){document.getElementById("StrengthComment").innerText = "Can make one cart trip."}
			else if (variableValue < 11 ){document.getElementById("StrengthComment").innerText = "Average."}
			else if (variableValue < 13 ){document.getElementById("StrengthComment").innerText= "Strong."}
			else if (variableValue < 15 ){document.getElementById("StrengthComment").innerText = "Visibly toned."}
			else if (variableValue < 17 ){document.getElementById("StrengthComment").innerText = "Muscular."}
			else if (variableValue < 19 ){document.getElementById("StrengthComment").innerText = "Heavily Muscular"}
			else if (variableValue === 20 ){document.getElementById("StrengthComment").innerText = "Pinnacle of brawn"}

			});
		story.ObserveVariable("dexterity", function(variableName, variableValue){
			document.getElementById("DexterityNum").innerText = variableValue
		if (variableValue === 1) {document.getElementById("DexterityComment").innerText = "Barely Mobile."}
			else if (variableValue < 3) {document.getElementById("DexterityComment").innerText = "Painful Movement."}
			else if (variableValue < 5) {document.getElementById("DexterityComment").innerText = "Difficulty Moving."}
			else if (variableValue < 7 ){document.getElementById("DexterityComment").innerText = "Total Klutz."}
			else if (variableValue < 9 ){document.getElementById("DexterityComment").innerText = "Somewhat Slow."}
			else if (variableValue < 11 ){document.getElementById("DexterityComment").innerText = "Average."}
			else if (variableValue < 13 ){document.getElementById("DexterityComment").innerText= "Quick."}
			else if (variableValue < 15 ){document.getElementById("DexterityComment").innerText = "Nimble."}
			else if (variableValue < 17 ){document.getElementById("DexterityComment").innerText = "Light on your feet."}
			else if (variableValue < 19 ){document.getElementById("DexterityComment").innerText = "Graceful"}
			else if (variableValue === 20 ){document.getElementById("DexterityComment").innerText = "Swift as a River"}
		});
		story.ObserveVariable("consitution", function(variableName, variableValue){
			document.getElementById("ConstitutionNum").innerText = variableValue
		if (variableValue === 1) {document.getElementById("ConstitutionComment").innerText = "Anemic."}
			else if (variableValue < 3) {document.getElementById("ConstitutionComment").innerText = "Frail."}
			else if (variableValue < 5) {document.getElementById("ConstitutionComment").innerText = "Brusied by a touch."}
			else if (variableValue < 7 ){document.getElementById("ConstitutionComment").innerText = "Prone to Illness."}
			else if (variableValue < 9 ){document.getElementById("ConstitutionComment").innerText = "Easily Winded."}
			else if (variableValue < 11 ){document.getElementById("ConstitutionComment").innerText = "Average."}
			else if (variableValue < 13 ){document.getElementById("ConstitutionComment").innerText= "Fortified."}
			else if (variableValue < 15 ){document.getElementById("ConstitutionComment").innerText = "Peak Physique"}
			else if (variableValue < 17 ){document.getElementById("ConstitutionComment").innerText = "Perfect Vitality."}
			else if (variableValue < 19 ){document.getElementById("ConstitutionComment").innerText = "Never wears down."}
			else if (variableValue === 20 ){document.getElementById("ConstitutionComment").innerText = "I can do this all day."}
		});
		story.ObserveVariable("intelligence", function(variableName, variableValue){
			document.getElementById("IntelligenceNum").innerText = variableValue
		if (variableValue === 1) {document.getElementById("IntelligenceComment").innerText = "Animalistic."}
			else if (variableValue < 3) {document.getElementById("IntelligenceComment").innerText = "Rather Animalistic."}
			else if (variableValue < 5) {document.getElementById("IntelligenceComment").innerText = "Limited Knowledge."}
			else if (variableValue < 7 ){document.getElementById("IntelligenceComment").innerText = "Complete Ditz."}
			else if (variableValue < 9 ){document.getElementById("IntelligenceComment").innerText = "Forgetful"}
			else if (variableValue < 11 ){document.getElementById("IntelligenceComment").innerText = "Average."}
			else if (variableValue < 13 ){document.getElementById("IntelligenceComment").innerText= "Logical"}
			else if (variableValue < 15 ){document.getElementById("IntelligenceComment").innerText = "Fairly Intelligent"}
			else if (variableValue < 17 ){document.getElementById("IntelligenceComment").innerText = "Very Intelligent."}
			else if (variableValue < 19 ){document.getElementById("IntelligenceComment").innerText = "Smartest in the Room"}		
			else if (variableValue === 20 ){document.getElementById("IntelligenceComment").innerText = "Famous Genius"}
		});
		story.ObserveVariable("wisdom", function(variableName, variableValue){
			document.getElementById("WisdomNum").innerText = variableValue
		if (variableValue === 1) {document.getElementById("WisdomComment").innerText = "Barely Aware."}
			else if (variableValue < 3) {document.getElementById("WisdomComment").innerText = "Oblivious"}
			else if (variableValue < 5) {document.getElementById("WisdomComment").innerText = "No Forethought"}
			else if (variableValue < 7 ){document.getElementById("WisdomComment").innerText = "No Common Sense"}
			else if (variableValue < 9 ){document.getElementById("WisdomComment").innerText = "Unaware"}
			else if (variableValue < 11 ){document.getElementById("WisdomComment").innerText = "Average."}
			else if (variableValue < 13 ){document.getElementById("WisdomComment").innerText= "Insightful."}
			else if (variableValue < 15 ){document.getElementById("WisdomComment").innerText = "Intuitive."}
			else if (variableValue < 17 ){document.getElementById("WisdomComment").innerText = "Amazingly Perceptive."}
			else if (variableValue < 19 ){document.getElementById("WisdomComment").innerText = "Source of Wisdom"}
			else if (variableValue === 20 ){document.getElementById("WisdomComment").innerText = "Nearly Prescient"}
		
		});
		story.ObserveVariable("charisma", function(variableName, variableValue){
			document.getElementById("CharismaNum").innerText = variableValue
		if (variableValue === 1) {document.getElementById("CharismaComment").innerText = "Repelling Presence."}
			else if (variableValue < 3) {document.getElementById("CharismaComment").innerText = "Minimal Thought"}
			else if (variableValue < 5) {document.getElementById("CharismaComment").innerText = "Unsociable"}
			else if (variableValue < 7 ){document.getElementById("CharismaComment").innerText = "Uninteresting"}
			else if (variableValue < 9 ){document.getElementById("CharismaComment").innerText = "Kinda a Bore"}
			else if (variableValue < 11 ){document.getElementById("CharismaComment").innerText = "Average."}
			else if (variableValue < 13 ){document.getElementById("CharismaComment").innerText= "Mildy Interesting."}
			else if (variableValue < 15 ){document.getElementById("CharismaComment").innerText = "Popular."}
			else if (variableValue < 17 ){document.getElementById("CharismaComment").innerText = "Quite Eloquent."}
			else if (variableValue < 19 ){document.getElementById("CharismaComment").innerText = "Everyone's Friend"}
			else if (variableValue === 20 ){document.getElementById("CharismaComment").innerText = "Renowned"}
		});
	//Status Bars
		let currentHp = 0;
		let maxHp = 0;
		let currentWill = 0;
		let maxWill = 0;
		let currentLust =0;
		let maxLust = 100;
		let currentXp= 0;
		let needXp= 0;
		function percent(x,y){
			return (x/y)*100;
		};
		
		 
		story.ObserveVariable("health", function(variableName, newValue) {
			currentHp = newValue;	
			document.getElementById("healthNum").innerText = currentHp + " / "+ maxHp;
			const healthPercent = percent(currentHp,maxHp);
			document.getElementById("healthBar").style.width = `${healthPercent}%`;
		});
		story.ObserveVariable("maxHealth", function(variableName, newValue) {
			maxHp = newValue;
		});
		story.ObserveVariable("xp", function(variableName, newValue) {
			currentXp = newValue;
			document.getElementById("xpNum").innerText = currentXp + " / "+ needXp;
			const xpPercent = percent(currentXp,needXp);
			document.getElementById("xpBar").style.width = `${xpPercent}%`;
			});
		story.ObserveVariable("needxp", function(variableName, newValue) {
			needXp = newValue;
			});
			
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
	document.getElementById('myAudio').volume = 0.15; // 50% volume
    document.getElementById('playButton').addEventListener('click', function() {
		var audio = document.getElementById('myAudio')
		  if (audio.paused) {
            audio.play();
        } else {
            audio.pause(); // Optional: Restart the song if already playing
        }
        if (isImageOne) {
            document.getElementById('buttonImage').src = 'IMAGE/Icon/Pause Button.gif';
        } else {
            document.getElementById('buttonImage').src = 'IMAGE/Icon/Play Button.gif';
        }
	
        isImageOne = !isImageOne; // Toggle the flag
    });


  let allowClick = true; // Flag to control whether clicks are allowed

  function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
  }

  function createCardImagesArray() {
    const images = [
      'IMAGE/Flipgame/Divination.png',
      'IMAGE/Flipgame/Abjuration.png',
      'IMAGE/Flipgame/Enchantment.png',
      'IMAGE/Flipgame/Necromancy.png',
      'IMAGE/Flipgame/Illusion.png',
      'IMAGE/Flipgame/Conjuration.png',
      'IMAGE/Flipgame/Evocation.png',
      'IMAGE/Flipgame/Transmutation.png'
    ];
    return [...images, ...images];
  }

  function initializeGame() {
    const cardImages = shuffle(createCardImagesArray());
    const gameBoard = document.getElementById('game-board');

    cardImages.forEach(image => {
      const card = document.createElement('div');
      card.classList.add('card');
      card.style.backgroundImage = `url('IMAGE/Flipgame/blank.png')`;
      card.setAttribute('data-image', image); // Store the image path as a data attribute
      card.addEventListener('click', handleCardClick);
      gameBoard.appendChild(card);
    });
  }

  function handleCardClick() {
    // Check if clicking is allowed
    if (!allowClick || this.classList.contains('selected')) {
      return;
    }

    this.classList.add('selected');
    this.style.backgroundImage = `url(${this.getAttribute('data-image')})`; // Reveal the image

    const selectedCards = document.querySelectorAll('.card.selected');

    if (selectedCards.length === 2) {
      allowClick = false; // Disable clicking while checking for a match
      setTimeout(() => {
        checkMatch();
        allowClick = true; // Re-enable clicking after checking for a match
      }, 1000);
    }
  }

	
  function checkMatch() {
    const selectedCards = document.querySelectorAll('.card.selected');

    if (selectedCards.length === 2) {
      const [firstCard, secondCard] = selectedCards;

      if (firstCard.getAttribute('data-image') === secondCard.getAttribute('data-image')) {
        // Hide the matching cards
        selectedCards.forEach(card => {
          card.classList.add('hidden');
          card.classList.remove('selected');
        });

        // Check if all cards are hidden
        if (document.querySelectorAll('.card.hidden').length === selectedCards.length * 8) {
          alert('Congratulations! Memory game solved.');
          // Perform additional actions or trigger events here
        } else {
					healDamage(1);
        }
      } else {
        // Reset the non-matching cards to the blank image
		  console.log("Current Health: " + story.variablesState["health"]);
		 dealDamage(1);
		  console.log("Current Health: " + story.variablesState["health"]);
        selectedCards.forEach(card => {
          card.classList.remove('selected');
          card.style.backgroundImage = 'url(IMAGE/Flipgame/blank.png)';

        });
      }
    }
  }

function dealDamage(x){
		 story.variablesState["health"] -= x;
	}
function healDamage(x) {
  story.variablesState["health"] += x;
  
  // Check if health exceeds maxHp and reset to maxHp if necessary
  if (story.variablesState["health"] > story.variablesState["maxHealth"]) {
    story.variablesState["health"] = story.variablesState["maxHealth"];
	}	
}
	
  window.addEventListener('load', initializeGame);
  
      // Initialize the Web Audio API
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Function to play the damage sound effect
    function playDamageSound() {
        var damageSound = audioContext.createBufferSource();
        var request = new XMLHttpRequest();
        request.open('GET', 'Music\soundeffects\Fist Hit B.wav', true);
        request.responseType = 'arraybuffer';

        request.onload = function () {
            audioContext.decodeAudioData(request.response, function (buffer) {
                damageSound.buffer = buffer;
                damageSound.connect(audioContext.destination);
                damageSound.start(0);
            });
        };

        request.send();
    }
story.ObserveVariable("health", function(newValue, oldValue) {
    if (newValue !== oldValue && !(newValue > oldValue)) {
        playDamageSound();
    }
});

// Function to play background music
function playBackgroundMusic() {
    var backgroundMusic = document.getElementById("MyAudio");
    backgroundMusic.play();
}

})(storyContent);