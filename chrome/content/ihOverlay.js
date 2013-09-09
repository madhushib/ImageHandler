Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/model.js");
Components.utils.import("resource://imagehandler/settings.js");

ImageHandlerChrome.init = function(){

	   var buttonNames = ["ipbutton-simple", "ipbutton-all", "ipbutton-left", "ipbutton-right", "ipbuttons"];

	   // Add buttons to toolbar on first run
	   Application.getExtensions(function (extensions) {
            let extension = extensions.get("ImageHandler@topolog.org");
            ImageHandler.Logger.info("First run: " + extension.firstRun);
            if (extension.firstRun) {
            	ImageHandler.Logger.info("Installing button on first run.");
    	    	buttonNames.forEach(function(buttonName){
	    		    var buttonId = buttonName + "-toolbar";
	    		    var isShow = ImageHandler.Settings.isShowOnToolbar(buttonName);
    		    	ImageHandlerChrome.installButton("nav-bar", buttonId, isShow);
	    		    ImageHandler.Logger.debug("Installed button: " + buttonId + " to toolbar, isShow="+isShow);
	    		});
            }
       });

      // Add buttons to context menu
	  var contextMenu = document.getElementById("contentAreaContextMenu");
	  if (contextMenu){
	    contextMenu.addEventListener("popupshowing", function(){

    	    	buttonNames.forEach(function(buttonName){
    	    		    var button = document.getElementById(buttonName + "-context");
    	    		    var isShow = ImageHandler.Settings.isShowOnContextMenu(buttonName);
    	    		    button.hidden = !isShow;
    	    		    ImageHandler.Logger.debug("button: " + button.id + ", hidden=" + button.hidden);
    	    		});

	    }, false);
	  }
};
window.addEventListener("load", ImageHandlerChrome.init, false);

/**
 * Return the "browser" type object.
 */
ImageHandlerChrome.getCurrentBrowser = function(){
    // gBrowser is "tabbrowser" type
    // tabbrowser.browser() method return the "browser" type
    // var mainTabBox = getBrowser().mTabBox;
    // return getBrowser().browsers[mainTabBox.selectedIndex];
    return gBrowser.selectedBrowser;
};

/**
 * Return the "tab" type object. gBrowser.selectedTab == gBrowser.mCurrentTab
 * and gBrowser.selectedBrowser ==
 * gBrowser.getBrowserAtIndex(gBrowser.tabContainer.selectedIndex) and
 * gBrowser.selectedBrowser == gBrowser.getBrowserForTab(gBrowser.selectedTab)
 * and gBrowser.tabs == gBrowser..tabContainer.childNodes
 */
ImageHandlerChrome.getCurrentTab = function(){
    return gBrowser.selectedTab;
};

ImageHandlerChrome.getFormattedString = function(key, parameters){
    // Get a reference to the strings bundle
    var stringsBundle = document.getElementById("ip-string-bundle");
    return stringsBundle.getFormattedString(key, parameters);
};



ImageHandlerChrome.pickImagesFromAllTabs = function(event){

    event.stopPropagation();

    // Collect tabs
    var tabs = [];
    for(var i=0; i<gBrowser.tabContainer.childNodes.length; i++){
        tabs.push(gBrowser.tabContainer.childNodes[i])
    }

    // Get document title
    var currentTabTitle = ImageHandlerChrome.getCurrentBrowser().contentDocument.title;

    // Pick image
    ImageHandlerChrome.pickImages(tabs, currentTabTitle);
};

ImageHandlerChrome.pickImagesFromTabs = function(event, tabTitle){

    event.stopPropagation();

    // Collect all tabs contain the given tabTitle
    var tabs = [];
    for (var i = 0, numTabs = gBrowser.browsers.length; i < numTabs; i++) {
        var curBrowser = gBrowser.getBrowserAtIndex(i);
        var curTitle = curBrowser.contentDocument.title;
        if (curTitle.indexOf(tabTitle) != -1) {
            tabs.push(gBrowser.tabContainer.childNodes[i]);
        }
    }

    // Pick image
    ImageHandlerChrome.pickImages(tabs, tabTitle);
};

/**
 * Pick image from the given tabs
 *
 * @param {Array[XULTab]}
 *            tabs
 * @param {String}
 *            title
 */


ImageHandlerChrome.getDocumentList = function(frame){

    var documentList = new Array();
    documentList.push(frame.document);

    var framesList = frame.frames;
    for (var i = 0; i < framesList.length; i++) {
        if (framesList[i].document != frame.document) {
            documentList.push(framesList[i].document);
        }
    }

    return documentList;
};

/**
 * 1. Filter duplicate image 2. Convert the given HTMLElement image list to the
 * ImageHandler.ImageInfo list 3. Sort image by Top
 *
 * @param {Array[HTMLElement]}
 *            htmlImageList
 * @return {Array[ImageHandler.ImageInfo]}
 */
ImageHandlerChrome.convertAndTidyImage = function(htmlImageList){

    // Filter image by url
    var tidiedHtmlImageList = ImageHandlerChrome.filterDuplicateImage(htmlImageList);
    ImageHandler.Logger.info("imageList.length  = " + htmlImageList.length + ", tidiedHtmlImageList.length  = " +
    tidiedHtmlImageList.length);

    // Convert to ImageHandler.ImageInfo
    var imageInfoList = new Array();
    var guid = (new Date()).getTime();
    for (var j = 0; j < tidiedHtmlImageList.length; j++) {
        var tImg = tidiedHtmlImageList[j];

        ImageHandler.Logger.info("image" + j + " = " + tImg.src);

        var image = new ImageHandler.ImageInfo(guid++, tImg, ImageHandlerChrome.getImageTop(tImg));

        ImageHandlerChrome.ImageUtils.updateFileExtensionByMIME(image);
        ImageHandlerChrome.ImageUtils.updateFileSizeFromCache(image);
        ImageHandlerChrome.ImageUtils.updateFileNameFromCache(image);

        imageInfoList.push(image);
    }

    // Sort by the image top
    imageInfoList.sort(ImageHandlerChrome.sortImagesByTop);

    return imageInfoList;
};

/**
 * Filter duplicate image by image URL
 *
 * @param {Array[HTMLElement]}
 *            imageList
 * @return {Array[HTMLElement]}
 */
ImageHandlerChrome.filterDuplicateImage = function(imageList){

    var results = new Array();

    imageList.sort(ImageHandlerChrome.sortImagesBySrc);

    for (var i = 0; i < imageList.length; i++) {
        if ((i + 1 < imageList.length) && (imageList[i].src == imageList[i + 1].src)) {
            continue;
        }

        results.push(imageList[i]);
    }

    return results;
};

/**
 * Sort image by image src
 *
 * @param {HTMLElement}
 *            imageOne
 * @param {HTMLElement}
 *            imageTwo
 */
ImageHandlerChrome.sortImagesBySrc = function(imageOne, imageTwo){
    var imageOneSrc = imageOne.src;
    var imageTwoSrc = imageTwo.src;

    var sortValue = 1;

    if (imageOneSrc == imageTwoSrc) {
        sortValue = 0;
    } else if (imageOneSrc < imageTwoSrc) {
        sortValue = -1;
    }

    return sortValue;
};

/**
 * Sort image by image top
 *
 * @param {ImageHandler.ImageInfo}
 *            imageOne
 * @param {ImageHandler.ImageInfo}
 *            imageTwo
 */
ImageHandlerChrome.sortImagesByTop = function(imageOne, imageTwo){
    var imageOneTop = imageOne.top;
    var imageTwoTop = imageTwo.top;

    var sortValue = 1;

    if (imageOneTop == imageTwoTop) {
        sortValue = 0;
    } else if (imageOneTop < imageTwoTop) {
        sortValue = -1;
    }

    return sortValue;
};

/**
 * Get the top of image element
 *
 * @param {HTMLElement}
 *            image
 */
ImageHandlerChrome.getImageTop = function(image){

    var top =image.getBoundingClientRect().top + document.documentElement.scrollTop;

    return top;
};

ImageHandlerChrome.onPopupMenuShowing = function(event){

    var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.imagehandler.")

    // update menu items
    var configureMenuitem;
    var menuPopup = event.target;
    var children = menuPopup.children;
    for (var i = children.length - 1; i >= 0; i--) {
        var child = children[i];
        if (child.id == null || child.id == "") {
            menuPopup.removeChild(child); // Remove all dynamic menu items
        } else if(child.id == "ipbtn-menu-configure"){
        	configureMenuitem = child; // Locate configure menu
        } else if(child.id == "ipbtn-menu-configure-doubleclick-save"){
        	child.setAttribute("checked", prefs.getBoolPref("collector.doubleclickImageToSave.enable")); // Update check status
        } else if(child.id == "ipbtn-menu-configure-drap-save"){
            child.setAttribute("checked", prefs.getBoolPref("collector.dragImageToSave.enable")); // Update check status
        }
    }


    // Generate dynamic menu item by tab title
    var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

    // Split current tab title to collect feeds
    var currentTabTitle = ImageHandlerChrome.getCurrentBrowser().contentDocument.title;

    var separator = /-|_|\(|\)|\[|\]|\|/;
    var feedTexts = currentTabTitle.split(separator);
    var feeds = new Array();
    for (var i = 0; i < feedTexts.length; i++) {
        var feedText = feedTexts[i].trim();
        if (feedText.length > 1) { // collect only feedText is larger than 1
									// chars
            var feed = {
                text: feedText,
                occurrence: 0
            }
            ImageHandler.Logger.info("feed = [" + feed.text + ", " + feed.occurrence + "]");
            feeds.push(feed);
        }
    }

    // collect statistics from all tabs
    for (var i = 0, numTabs = gBrowser.browsers.length; i < numTabs; i++) {
        var curBrowser = gBrowser.getBrowserAtIndex(i);
        var curTitle = curBrowser.contentDocument.title;
        feeds.forEach(function(feed){
            if (curTitle.indexOf(feed.text) != -1) {
                feed.occurrence = feed.occurrence + 1;
            }
        });
    }

    // sort occurrence
    feeds.sort(function(feed1, feed2){
        return feed1.occurrence - feed2.occurrence;
    });

    // Add menu items when occurrence is larger than 1
    var hasNewMenuitem = false;
    feeds.forEach(function(feed){
        if (feed.occurrence > 1) {
            var label = ImageHandlerChrome.getFormattedString("pickButtonDynamicMenuItem", [feed.text, feed.occurrence]);
            var menuitem = document.createElementNS(XUL_NS, "menuitem");
            menuitem.setAttribute("label", label);
            menuitem.setAttribute("class", "menuitem-iconic dynamic-pick-menu-item");
            menuitem.addEventListener("command", function(e){
                ImageHandlerChrome.pickImagesFromTabs(e, feed.text);
            }, false);

            menuPopup.insertBefore(menuitem, configureMenuitem);
            hasNewMenuitem = true;
        }
    });

    if(hasNewMenuitem){
    	var separator = document.createElementNS(XUL_NS, "menuseparator");
    	menuPopup.insertBefore(separator, configureMenuitem);
    }
};
ImageHandlerChrome.pickImages = function(tabs, title){

    // init cache session
    var cacheService = Cc["@mozilla.org/network/cache-service;1"].getService(Ci.nsICacheService);
    ImageHandlerChrome.httpCacheSession = cacheService.createSession("HTTP", Ci.nsICache.STORE_ANYWHERE, Ci.nsICache.STREAM_BASED);
    ImageHandlerChrome.httpCacheSession.doomEntriesIfExpired = false;

    // Get images from all given tabs
    var imageInfoList = new Array();
    tabs.forEach(function(tab){
        ImageHandler.Logger.debug("handling tab = " + tab);
        var browser = gBrowser.getBrowserForTab(tab);
        var contentWindow = browser.contentWindow;

        var documentList = ImageHandlerChrome.getDocumentList(contentWindow);
        for (var i = 0; i < documentList.length; i++) {
            // handle current document
            var currentDocument = documentList[i];
            var currentImageList = new Array();
            var documentImageList = currentDocument.getElementsByTagName('img');
            for (var j = 0; j < documentImageList.length; j++) {
                var image = documentImageList[j];
                if (image.src != null && image.src != "") {
                    currentImageList.push(image);
                }
            }
            ImageHandler.Logger.info("document = " + currentDocument.title + ", images = " + currentImageList.length);

            imageInfoList = imageInfoList.concat(ImageHandlerChrome.convertAndTidyImage(currentImageList));
        }// end for each document
    });

    // Collect tabs to be closed after saved images
    var listeners = [new ImageHandlerChrome.CloseTabListener(tabs)];

    // Prepare parameters
    var params = {
        "imageList": imageInfoList,
        "title": title,
        "listeners": listeners,
        "browser": gBrowser.selectedBrowser,
        "popupNotifications": PopupNotifications
    };
    var mainWindow = window.openDialog("chrome://imagehandler/content/pick.xul", "PickImage.mainWindow", "chrome,centerscreen,resizable, dialog=no, modal=no, dependent=no,status=yes", params);
    mainWindow.focus();
};

ImageHandlerChrome.enableOrDisablePref = function(event, prefName){
    event.stopPropagation();
    var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.imagehandler.")
    var value = prefs.getBoolPref(prefName);
    prefs.setBoolPref(prefName, !value);
};



/** **************** CloseTabListener Object Class ******************** */
/**
 * Provides the CloseTabListener class to close browser tabs after saved images
 *
 * @namespace ImageHandlerChrome
 * @class ImageHandlerChrome.CloseTabListener
 * @constructor
 */
ImageHandlerChrome.CloseTabListener = function(tabs) {
    this.tabs = tabs;
};


