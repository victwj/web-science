/**
 * Content script for the Fathom module. Uses Mozilla Fathom
 * to classify the DOM elements of a page.
 * @module webScience.fathom.content
 *
 * TODO: 
 * - rerun fathom on mutation observer?
 * - keep track of viewTime of classified elements using intersection observer?
 * - draw borders as an option?
 * - memoizations
 */

import {ruleset, type} from "fathom-web";

let traineesAdded = false;

// Add user rulesets to the window global
function addTrainees(trainees, runFathom = true) {
    for (const [name, rules] of trainees) {
        window.webScience.fathom.trainees.set(name, rules);
    }
    traineesAdded = true;
}


function runTrainee(ruleName, results, color = "red") { 
    const trainees = window.webScience.fathom.trainees;
    const trainee = trainees.get(ruleName);
    const facts = trainee.rulesetMaker().against(document);
    facts.setCoeffsAndBiases(trainee.coeffs, [[ruleName, trainee.bias]]); // bias not working properly

    // Run the ruleset
    const allNodes = facts.get(type(ruleName)); 

    // For all candidate nodes, observe/borderize those with high scores
    for (const fnode of allNodes) {
        let score = fnode.scoreFor(ruleName);
        if (score >= 0.5) {
            fnode.element.style.border = "5px solid " + color;
            console.log("*** Found " + ruleName + " node ***\n" +
                        "Confidence: " + score.toString(10));
			fnode.element.dataset.totalViewTime = 0;
			fnode.element.dataset.lastViewStarted = 0;

            results.set(fnode.element, {
                "score": score,
                "type": ruleName,
                "fnode": fnode,
                "vector": fnode._types.get(ruleName).score,
                "clicked": false,
            });
        }
    }

    console.log("Finished ruleset " + ruleName);
}

function runAllTrainees() {
    const trainees = window.webScience.fathom.trainees;
    let results = new Map();
    for (const [ruleName, rules] of trainees) {
        runTrainee(ruleName, results)
    }
    return results;
}


(function() {
    // Check if content script is already running
    if ("webScience" in window) {
        if ("fathom" in window.webScience) {
            return;
        }
        else {
            window.webScience.fathom = {
                trainees: new Map(),
                addTrainees: addTrainees,
            }
        }
    }
    else {
        // Else, this is the first webScience initialization
        window.webScience = {};
        window.webScience.fathom = {
            trainees: new Map(),
            addTrainees: addTrainees,
        }
    }

    /**
     * Whether the elements of this page have been classified.
     * @type {boolean}
     */
    let pageClassified = false;


    // Function to call once pageManager is loaded
    function pageManagerLoaded() {
        console.log("pageManager loaded, running fathom content script");
        const pageManager = window.webScience.pageManager;

        // Listen for messages from background script
        // Background script will tell us if this page should be classified
        // and what Fathom rulesets to use
        browser.runtime.onMessage.addListener((message) => {

            // Don't do anything if isClassifiable == false
            if (message.type !== "webScience.fathom.isClassifiable" ||
                !message.isClassifiable) {
                return;
            }

            // Don't do anything if this page already ran fathom once
            if (pageClassified) {
                console.log("Page already classified, returning");
                return;
            }

            // Run fathom, but wait until trainees are added
            function runFathom() {
                if (!traineesAdded) {
                    console.log("trainees not yet added");
                    setTimeout(runFathom, 200);
                }
                else {
                    // Set to true before we run to avoid parallel runs
                    pageClassified = true;

                    console.log("Running fathom");

                    // run Fathom here
                    let results = runAllTrainees(message.trainees);

                    // Send results to background script
                    console.log("Sending fathom results");
                    console.log(results);
                    pageManager.sendMessage({
                        type: "webScience.fathom.fathomData",
                        test: "hello from content script",
                        results: results
                    });
                    console.log("Fathom results sent");
                }
            }
            runFathom();
        });
    }

    // If pageManager is loaded, call our main function
    if ("webScience" in window && "pageManager" in window.webScience) {
        pageManagerLoaded();
    }

    // If pageManager is not loaded, push our main function to queue
    else {
        if (!("pageManagerHasLoaded" in window)) {
            window.pageManagerHasLoaded = [];
        }
        window.pageManagerHasLoaded.push(pageManagerLoaded());
    }

    console.log("content script initialized");
})();

