// initialize variables
var event = "";
var tries = 0;
var loading = true;
var loadError = false;

window.onload = extension;

/*
 If error arises while running extension, wait and try again before changing loading to false
*/
function error(errMsg) {
    if (tries == 10) {
        loading = false;
        loadError = true;
    } else {
        tries += 1;
        console.log("ERROR: ", errMsg);
        console.log("trying extension again :", tries);
        setTimeout(extension, 250);
    }
}

/*
 Main extension function - retrieves info from DOM and adds to event object
*/
function extension() {
    $(document).ready(function () {
        try {
            // GET EVENT TITLE
            var title = "";
            var temp = $("[data-testid='event-permalink-event-name']")[0];
            if (typeof temp !== 'undefined') {
                title = temp.innerText;
                console.log("title", title);
            } else {
                return error("title");
            }

            // set of functions to get text from within HTML tag, separated by spaces or line breaks
            // adapted from http://stackoverflow.com/questions/2836317/using-jquery-to-gather-all-text-nodes-from-a-wrapped-set-separated-by-spaces
            function collectTextNodes(element, texts) {
                for (var child = element.firstChild; child !== null; child = child.nextSibling) {
                    if (child.nodeType === 3)
                        texts.push(child);
                    else if (child.nodeType === 1)
                        collectTextNodes(child, texts);
                }
            }

            function getTextWithSpaces(element) {
                var texts = [];
                collectTextNodes(element, texts);
                for (var i = texts.length; i-- > 0;)
                    texts[i] = texts[i].data;
                return texts.join(' ');
            }

            function getTextWithBreaks(element) {
                var texts = [];
                collectTextNodes(element, texts);
                for (var i = texts.length; i-- > 0;)
                    texts[i] = texts[i].data;
                return texts.join('\n');
            }

            // get text from Facebook's event summary
            var element = document.getElementById("event_summary")
            var textWithSpaces = getTextWithSpaces(element);
            var textWithBreaks = getTextWithBreaks(element);

            // GET ADDRESS
            var address = "";

            // temp1: if address is linked to map; temp2: address is plain text
            var temp1 = textWithSpaces.match("Hide Map (.*) Report")
            var temp2 = textWithBreaks.match("pin\n(.*)")

            if (temp1 !== null) {
                address = temp1[1];
            } else if (temp2 !== null) {
                address = temp2[1]
            }

            if (address == "Show Map") {
                return error();
            }

            // GET START AND END TIMES
            // uses MIT's indispensable Moment.js (momentjs.com)

            // get Facebook-defined startDate for event
            var DT = $("[class='_publicProdFeedInfo__timeRowTitle _5xhk']").attr('content');
            var startDT = ""
            var endDT = ""

            // use RegEx to define temporary start and end
            var start = DT.match("(.*) to")
            if (start !== null) {
                startDT = start[1]
                endDT = DT.match("to (.*)")[1]
            }

            // if end doesn't exist, automatically make event one hour long
            else {
                startDT = DT
                var sum = moment(startDT, moment.ISO_8601).add(1, 'hours')
                endDT = sum.format()
            }
            console.log(DT);
            console.log(startDT);
            console.log(endDT);

            // GET DESCRIPTION
            // use id if available; else by classes
            var description = "";
            var temp = $("[data-testid='event-permalink-details']")[0];
            if (typeof temp !== 'undefined') {
                description = temp.innerText;
            } else {
                description = $("#event_description").text();
            }
            if (description.substr(0, 14) == "No description") {
                description = "";
            }

            // add info to event object
            event = {
                'summary': title,
                'location': address,
                'description': description,
                'start': {
                    'dateTime': startDT,
                },
                'end': {
                    'dateTime': endDT,
                },
            };
            console.log("event created", event);
            loading = false;
        }

        // run error function if any errors thrown
        catch (err) {
            console.log(err.message);
            error();
        }
    })
};

// listen for messages
chrome.runtime.onMessage.addListener(
    function (message, sender, sendResponse) {
        switch (message.type) {
            // send event when popup asks
        case "getEvent":
            if (!loading && !loadError) {
                console.log("sendResponse", event);
                sendResponse(event);
            }
            else if (!loading && loadError) {
                console.log("event null");
                sendResponse("loading-error");
            }

            else if (loading) {
                console.log("loading");
                sendResponse("loading");
            }
            break;

            // if URL changed, re-run extension
        case "tabUpdated":
            sendResponse("received");
            loading = true;
            loadError = false;
            tries = 0;
            console.log("tabUpdated");
            extension();
            break;

            // tell popup if loading error occurred
//        case "checkError":
//            sendResponse(loading);
//            break;

            // else, log error
        default:
            console.error("Unrecognised message: ", message);
        }
    }
);
