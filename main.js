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

        let saveEl = document.getElementById("savetab");
        if (saveEl) saveEl.addEventListener("click", function(event) {
            try {
                window.localStorage.setItem('save-state', savePoint);
                document.getElementById("reload").removeAttribute("disabled");
                window.localStorage.setItem('theme', document.body.classList.contains("dark") ? "dark" : "");
            } catch (e) {
                console.warn("Couldn't save state");
            }

        });

        let reloadEl = document.getElementById("loadtab");
        if (!hasSave) {
            reloadEl.setAttribute("disabled", "disabled");
        }
        reloadEl.addEventListener("click", function(event) {
            if (reloadEl.getAttribute("disabled"))
                return;

            removeAll("p");
            removeAll("img");
			removeAll(".choice");
            try {
                let savedState = window.localStorage.getItem('save-state');
                if (savedState) story.state.LoadJson(savedState);
            } catch (e) {
                console.debug("Couldn't load save state");
            }
            continueStory(true);
        });

        let themeSwitchEl = document.getElementById("theme-switch");
        if (themeSwitchEl) themeSwitchEl.addEventListener("click", function(event) {
            document.body.classList.add("switched");
            document.body.classList.toggle("dark");
        });

	let creditEl = document.getElementById("credits");
	if (creditEl) creditEl.addEventListener("click", function(event){
	removeAll("p");
        removeAll("img");
	     });
	}
	// Get references to the buttons using their IDs
	var btnShowPage1 = document.getElementById("scenetab");
	var btnShowPage2 = document.getElementById("statstab");
	var btnShowPage3 = document.getElementById("statustab");
	var btnShowPage4 = document.getElementById("inventorytab");
	var btnShowPage5 = document.getElementById("spellstab");
	var btnShowPage6 = document.getElementById("savetab");
	var btnShowPage7 = document.getElementById("loadtab");

	// Get references to the page div elements using their IDs
	var page1 = document.getElementById("story");
	var page2 = document.getElementById("stats");
	var page3 = document.getElementById("status");
	var page4 = document.getElementById("inventory");
	var page5 = document.getElementById("spells");
	var page6 = document.getElementById("save");
	var page7 = document.getElementById("load");

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
	btnShowPage7.addEventListener("click", function() {
	hideAllPages();
	page7.style.display = "block";
  
	});

	// Function to hide all page div elements
	function hideAllPages() {
	page1.style.display = "none";
	page2.style.display = "none";
	page3.style.display = "none";
	page4.style.display = "none";
	page5.style.display = "none";
	page6.style.display = "none";
	page7.style.display = "none";
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
})(storyContent);