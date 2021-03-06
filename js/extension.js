// initialize variables
var event = "";
var gettingInfo = false;
var getError = false;
var loading = true;

window.onload = getInfo;

/*
 * Main extension function - retrieves info from DOM and adds to event object
 */
function getInfo() {
    $(document).ready(function () {
        loading = false;
        console.log("loading false")
        gettingInfo = true;
        try {
            // ~~~~~~~~~~~~~~~ EVENT TITLE ~~~~~~~~~~~~~~

            var title = "";
            var temp = $("[data-testid='event-permalink-event-name']")[0];
            if (typeof temp !== 'undefined') {
                title = temp.innerText;
            } else {
                return error("title");
            }

            // ~~~~~~~~~~~~~~~ EVENT LOCATION ~~~~~~~~~~~~~~

            // get text from Facebook's event summary
            var element = document.getElementById("event_summary")
            var textWithBreaks = getTextWithBreaks(element);
            var location = "";

            var temp1 = textWithBreaks.match("pin\n(.*)\n")
            var temp2 = textWithBreaks.match("pin\n(.*)")
            console.log(textWithBreaks)
            console.log(temp1)
            console.log(temp2)
            // case 1: location is linked to map
            if (temp1 !== null) {
                location = temp1[1];

                // if location consists of name and address, include append second line (address) to first (name)
                var re = new RegExp(temp1[1] + "\n(.*)\n")
                var nextline = textWithBreaks.match(re)
                if (nextline != null && nextline !== "Show Map") {
                    location += ", " + nextline[1]
                }
            }

            // case 2: location is plain text
            // if (temp2 !== null) {
            //     location = temp2[1]
            // }

            // ~~~~~~~~~~~~~~~ EVENT DATE/TIME ~~~~~~~~~~~~~~
            // uses MIT's indispensable Moment.js

            // get Facebook-defined startDate for event
            var DT = $("[class='_2ycp _5xhk']").attr('content');
            var startDT = ""
            var endDT = ""

            // use RegEx to define temporary start and end
            var start = DT.match("(.*) to")
            if (start !== null) {
                startDT = start[1]
                endDT = DT.match("to (.*)")[1]
            }

            // if end doesn't exist, make event one hour long by default
            else {
                startDT = DT
                var sum = moment(startDT, moment.ISO_8601).add(1, 'hours')
                endDT = sum.format()
            }

            // ~~~~~~~~~~~~~~~ EVENT DESCRIPTION ~~~~~~~~~~~~~~

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

            // ~~~~~~~~~~~~~~~ UPDATE EVENT OBJECT ~~~~~~~~~~~~~~
            event = {
                'summary': title,
                'location': location,
                'description': description,
                'start': {
                    'dateTime': startDT,
                },
                'end': {
                    'dateTime': endDT,
                }
            };
            gettingInfo = false;
            console.log(event)
        }

        // run error function if any errors thrown
        catch (err) {
            error(err);
        }
    })
};


/*
 * If error arises while running extension, update error values
 */
function error(errMsg) {
    console.log("ERROR: ", errMsg);
    loading = false;
    getError = true;
    gettingInfo = false;
}

/*
 * Listen for messages from popup.js
 */
chrome.runtime.onMessage.addListener(
    function (message, sender, sendResponse) {
        switch (message.type) {
            // send event or error message when popup asks
        case "getEvent":
            var response;
            if (loading) {
                response = "loading";
            }
            else if (gettingInfo) {
                response = "getting info";
            }
            else if (getError) {
                response = "get-error";
            } else {
                response = event;
            }
            console.log(response)
            sendResponse(response);
            break;


            // if URL changed or replaced, re-run extension
        case "tabUpdated":
            sendResponse("received");
            loading = true;
            loadError = false;
            getInfo();
            break;

        case "tabReplaced":
            sendResponse("received");
            loading = true;
            loadError = false;
            getInfo();
            break;
        }
    }
);

/*
 * Set of functions to get text from within HTML tag, separated by spaces or line breaks
 * adapted from http://stackoverflow.com/questions/2836317/using-jquery-to-gather-all-text-nodes-from-a-wrapped-set-separated-by-spaces
 */
function collectTextNodes(element, texts) {
    for (var child = element.firstChild; child !== null; child = child.nextSibling) {
        if (child.nodeType === 3)
            texts.push(child);
        else if (child.nodeType === 1)
            collectTextNodes(child, texts);
    }
}

function getTextWithBreaks(element) {
    var texts = [];
    collectTextNodes(element, texts);
    for (var i = texts.length; i-- > 0;)
        texts[i] = texts[i].data;
    return texts.join('\n');
}
