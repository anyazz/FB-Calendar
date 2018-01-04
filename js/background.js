var SCOPES = ["https://www.googleapis.com/auth/calendar"];
var email;

// show extension and load scripts on Facebook event pages
// adapted from http://stackoverflow.com/questions/20855956/how-to-show-chrome-extension-on-certain-domains
function onWebNav(details) {
    if (details.frameId === 0) {
        // Top-level frame
        chrome.pageAction.show(details.tabId);
        console.log("fb");
        chrome.tabs.executeScript({
            file: "js/jquery-3.1.1.js"
        }, function () {
            console.log("jquery Loaded");
        });
        chrome.tabs.executeScript({
            file: "extension.js"
        }, function () {
            console.log("content loaded");
        });
    }
}
var filter = {
    url: [{
        urlMatches: '.*facebook.com/events/[0-9]+.*',
    }]
};
chrome.webNavigation.onCommitted.addListener(onWebNav, filter);
chrome.webNavigation.onHistoryStateUpdated.addListener(onWebNav, filter);

// get Google authentication token
chrome.identity.getAuthToken({
    'interactive': false
}, function (token) {
    return true;
});

// when tab url changed, notify extension.js
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') {
        console.log("complete")
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: "tabUpdated"
            }, function (response) {
                console.log("message received:", response)
            });
        });
    }
});

chrome.tabs.onReplaced.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') {
        console.log("complete")
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: "tabReplaced"
            }, function (response) {
                console.log("message received:", response)
            });
        });
    }
});

// Get user email address for bug reports
chrome.identity.getProfileUserInfo(function (info) {
    email = info.email;
});

// On request, send user email to popup.js
chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type == "getEmail") {
        sendResponse({
            email: email
        })
    }
});
